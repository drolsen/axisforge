import { initWebGPU } from '../../engine/render/gpu/webgpu.js';
import { GetService } from '../../engine/core/index.js';

export function initViewport() {
  const canvas = document.createElement('canvas');
  canvas.id = 'viewport';
  document.body.appendChild(canvas);
  initWebGPU(canvas);
  const UIS = GetService('UserInputService');
  UIS.AttachCanvas(canvas);
}
