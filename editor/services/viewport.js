import { initWebGPU } from '../../engine/render/gpu/webgpu.js';
import { GetService } from '../../engine/core/index.js';
import { initEditorCamera, focusCameraOnBounds } from './cameraEditor.js';

export function initViewport({ mount } = {}) {
  const canvas = document.createElement('canvas');
  canvas.id = 'viewport';
  const target = mount ?? document.body;
  target.appendChild(canvas);
  const UIS = GetService('UserInputService');
  UIS.AttachCanvas(canvas);
  initEditorCamera(canvas);
  initWebGPU(canvas);
  return canvas;
}

export { focusCameraOnBounds };
