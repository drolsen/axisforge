import { GetService } from '../../core/index.js';

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

  const runService = GetService('RunService');

  let last = performance.now() / 1000;

  function frame(ts) {
    const now = ts / 1000;
    const dt = now - last;
    last = now;

    runService._step(dt);

    const encoder = device.createCommandEncoder();
    const view = context.getCurrentTexture().createView();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view,
        clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1 },
        loadOp: 'clear',
        storeOp: 'store'
      }]
    });
    pass.end();
    device.queue.submit([encoder.finish()]);

    runService._heartbeat(dt);

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
