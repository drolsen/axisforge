import FrameGraph from '../framegraph/index.js';
import ClearPass from '../passes/clearPass.js';
import SkyPass from '../passes/skyPass.js';
import MeshPass from '../passes/meshPass.js';
import ShadowMapPass from '../lighting/shadowMapPass.js';
import HDRTarget from '../post/hdr.js';
import ACESPass from '../passes/acesPass.js';
import FXAAPass from '../passes/fxaaPass.js';
import * as DepthNormalPass from '../passes/depthNormalPass.js';
import * as SSAOPass from '../post/ssao.js';
import Materials from '../materials/registry.js';
import { PostFXSettings } from '../post/settings.js';
import { setGPUAdapterName, updateFrameMetrics } from '../framegraph/stats.js';
import { RunService } from '../../services/RunService.js';
import { setDevice } from './device.js';

export async function initWebGPU(canvas) {
  if (!('gpu' in navigator)) {
    console.warn('WebGPU not supported.');
    return;
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    console.warn('Failed to acquire GPU adapter');
    return;
  }

  setGPUAdapterName(adapter.name || 'Unknown GPU');

  const device = await adapter.requestDevice({});
  setDevice(device);

  const context = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();

  let curW = 0;
  let curH = 0;

  function clampSize(w, h) {
    const max2D = device.limits.maxTextureDimension2D || 8192;
    return [Math.min(w, max2D), Math.min(h, max2D)];
  }

  function resizeIfNeeded() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
    let w = Math.max(1, Math.floor(rect.width * dpr));
    let h = Math.max(1, Math.floor(rect.height * dpr));
    [w, h] = clampSize(w, h);
    if (w === curW && h === curH) {
      return false;
    }
    curW = w;
    curH = h;
    canvas.width = w;
    canvas.height = h;
    context.configure({ device, format, alphaMode: 'opaque' });
    return true;
  }

  new ResizeObserver(() => resizeIfNeeded()).observe(canvas);
  resizeIfNeeded();

  Materials.init(device);

  const hdrTarget = new HDRTarget(device);
  const frameGraph = new FrameGraph(device, context);
  const shadowPass = new ShadowMapPass(device, () => hdrTarget.getSize());
  const clearPass = new ClearPass(device, () => hdrTarget.getView());
  const skyPass = new SkyPass(device, 'rgba16float', () => hdrTarget.getView());

  const depthNormalState = { enabled: false, resources: null };
  const ssaoState = { enabled: false, resources: null };

  const meshPass = new MeshPass(
    device,
    'rgba16float',
    () => hdrTarget.getView(),
    () => hdrTarget.getSize(),
    () => depthNormalState.resources?.depthView ?? null,
    () => ssaoState.resources,
  );
  const acesPass = new ACESPass(device, hdrTarget, 'rgba16float');
  const fxaaPass = new FXAAPass(device, acesPass, format);

  const depthNormalWrapper = {
    name: 'DepthNormalPass',
    async init() {},
    execute(encoder) {
      if (!depthNormalState.enabled) {
        depthNormalState.resources = null;
        return;
      }
      const result = DepthNormalPass.render(device, encoder);
      depthNormalState.resources = result || DepthNormalPass.getResources() || depthNormalState.resources;
    },
  };

  const ssaoWrapper = {
    name: 'SSAOPass',
    async init() {},
    execute(encoder) {
      if (!ssaoState.enabled) {
        ssaoState.resources = null;
        return;
      }
      const normalView = depthNormalState.resources?.normalView ?? null;
      const result = SSAOPass.render(device, encoder, normalView);
      ssaoState.resources = normalView ? (result || SSAOPass.getResources() || ssaoState.resources) : null;
    },
  };

  frameGraph.addPass(shadowPass);
  frameGraph.addPass(depthNormalWrapper);
  frameGraph.addPass(clearPass);
  frameGraph.addPass(skyPass);
  frameGraph.addPass(ssaoWrapper);
  frameGraph.addPass(meshPass);
  frameGraph.addPass(acesPass);
  frameGraph.addPass(fxaaPass);
  await frameGraph.init();

  let last = performance.now() / 1000;

  function frame(ts) {
    const now = ts / 1000;
    const dt = now - last;
    last = now;

    updateFrameMetrics(dt);

    if (typeof RunService._step === 'function') {
      RunService._step();
    }

    const resized = resizeIfNeeded();
    const width = canvas.width || curW;
    const height = canvas.height || curH;

    const wantDepthNormal = Boolean(PostFXSettings.ssao);
    if (wantDepthNormal && !depthNormalState.enabled) {
      DepthNormalPass.enable(device, 'rgba8unorm', width, height);
      depthNormalState.enabled = true;
      meshPass.sceneBindGroupDirty = true;
    } else if (!wantDepthNormal && depthNormalState.enabled) {
      DepthNormalPass.disable();
      depthNormalState.enabled = false;
      depthNormalState.resources = null;
      meshPass.sceneBindGroupDirty = true;
    }
    if (depthNormalState.enabled) {
      const changed = DepthNormalPass.resize(device, width, height);
      if (changed) {
        meshPass.sceneBindGroupDirty = true;
      }
    }

    const wantSSAO = Boolean(PostFXSettings.ssao);
    if (wantSSAO && !ssaoState.enabled) {
      SSAOPass.enable(device, 'r8unorm', width, height);
      ssaoState.enabled = true;
      meshPass.sceneBindGroupDirty = true;
    } else if (!wantSSAO && ssaoState.enabled) {
      SSAOPass.disable();
      ssaoState.enabled = false;
      ssaoState.resources = null;
      meshPass.sceneBindGroupDirty = true;
    }
    if (ssaoState.enabled) {
      const changed = SSAOPass.resize(device, width, height);
      if (changed || resized) {
        ssaoState.resources = SSAOPass.getResources();
        meshPass.sceneBindGroupDirty = true;
      }
    }

    const hdrChanged = hdrTarget.resize(width, height);
    const acesChanged = acesPass.resize(width, height);
    fxaaPass.resize(width, height);

    if (hdrChanged) {
      acesPass.bindGroupDirty = true;
    }
    if (acesChanged || hdrChanged) {
      fxaaPass.bindGroupDirty = true;
    }

    frameGraph.render();

    if (ssaoState.enabled) {
      ssaoState.resources = SSAOPass.getResources();
    }
    if (depthNormalState.enabled) {
      depthNormalState.resources = DepthNormalPass.getResources();
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);

  console.log('[WebGPU] Adapter:', adapter?.name ?? 'Unknown', 'max2D:', device.limits.maxTextureDimension2D);
}
