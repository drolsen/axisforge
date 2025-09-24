import FrameGraph from '../framegraph/index.js';
import ClearPass from '../passes/clearPass.js';
import SkyPass from '../passes/skyPass.js';
import MeshPass from '../passes/meshPass.js';
import ShadowMapPass from '../lighting/shadowMapPass.js';
import HDRTarget from '../post/hdr.js';
import ACESPass from '../passes/acesPass.js';
import FXAAPass from '../passes/fxaaPass.js';
import DepthNormalPass from '../passes/depthNormalPass.js';
import SSAOPass from '../post/ssao.js';
import Materials from '../materials/registry.js';
import { setGPUAdapterName, updateFrameMetrics } from '../framegraph/stats.js';
import { RunService } from '../../services/RunService.js';
import { setDevice } from './device.js';

export async function initWebGPU(canvas) {
  if (!navigator.gpu) {
    console.warn('WebGPU not supported');
    return;
  }
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    console.warn('Failed to acquire GPU adapter');
    return;
  }
  setGPUAdapterName(adapter.name || 'Unknown GPU');
  const device = await adapter.requestDevice();
  setDevice(device);
  const context = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format });

  Materials.init(device);

  const hdrTarget = new HDRTarget(device);
  const frameGraph = new FrameGraph(device, context);
  const shadowPass = new ShadowMapPass(device, () => hdrTarget.getSize());
  const depthNormalPass = new DepthNormalPass(device, () => hdrTarget.getSize());
  const clearPass = new ClearPass(device, () => hdrTarget.getView());
  const skyPass = new SkyPass(device, 'rgba16float', () => hdrTarget.getView());
  const ssaoPass = new SSAOPass(device, depthNormalPass);
  const meshPass = new MeshPass(
    device,
    'rgba16float',
    () => hdrTarget.getView(),
    () => hdrTarget.getSize(),
    () => depthNormalPass.getDepthView(),
    () => ssaoPass.getResources(),
  );
  const acesPass = new ACESPass(device, hdrTarget, 'rgba16float');
  const fxaaPass = new FXAAPass(device, acesPass, format);

  frameGraph.addPass(shadowPass);
  frameGraph.addPass(depthNormalPass);
  frameGraph.addPass(clearPass);
  frameGraph.addPass(skyPass);
  frameGraph.addPass(ssaoPass);
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

    const width = canvas.clientWidth * devicePixelRatio;
    const height = canvas.clientHeight * devicePixelRatio;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      context.configure({ device, format });
    }

    const hdrChanged = hdrTarget.resize(width, height);
    const depthChanged = depthNormalPass.resize(width, height);
    const ssaoChanged = ssaoPass.resize(width, height);
    const acesChanged = acesPass.resize(width, height);
    fxaaPass.resize(width, height);
    if (hdrChanged) {
      acesPass.bindGroupDirty = true;
    }
    if (acesChanged || hdrChanged) {
      fxaaPass.bindGroupDirty = true;
    }
    if (depthChanged || ssaoChanged) {
      meshPass.sceneBindGroupDirty = true;
      ssaoPass.bindGroupDirty = true;
    }

    frameGraph.render();

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
