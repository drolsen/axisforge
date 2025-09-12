import { initWebGPU } from '../../engine/render/gpu/webgpu.js';

export function initViewport() {
  const canvas = document.createElement('canvas');
  canvas.id = 'viewport';
  document.body.appendChild(canvas);
  initWebGPU(canvas);
}
