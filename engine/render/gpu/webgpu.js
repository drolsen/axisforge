import { GetService } from '../../core/index.js';
import FrameGraph from '../framegraph/index.js';
import ClearPass from '../passes/clearPass.js';
import SkyPass from '../passes/skyPass.js';
import MeshPass from '../passes/meshPass.js';
import Materials from '../materials/registry.js';

export async function initWebGPU(canvas) {
  if (!navigator.gpu) {
    console.warn('WebGPU not supported');
    return;
  }
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();
  const context = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format });

  Materials.init(device);

  const frameGraph = new FrameGraph(device, context);
  frameGraph.addPass(new ClearPass(device));
  frameGraph.addPass(new SkyPass(device, format));
  frameGraph.addPass(new MeshPass(device, format));
  await frameGraph.init();

  const runService = GetService('RunService');

  let last = performance.now() / 1000;

  function frame(ts) {
    const now = ts / 1000;
    const dt = now - last;
    last = now;

    runService._step(dt);

    const width = canvas.clientWidth * devicePixelRatio;
    const height = canvas.clientHeight * devicePixelRatio;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      context.configure({ device, format });
    }

    frameGraph.render();

    runService._heartbeat(dt);

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
