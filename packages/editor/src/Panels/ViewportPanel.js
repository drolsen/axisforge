import TransformGizmos from '../Gizmos/TransformGizmos.js';
import Instance from '../../../runtime-core/src/scene/Instance.js';

export default function ViewportPanel() {
  const el = document.createElement('div');
  el.id = 'viewport-panel';
  el.className = 'panel';
  el.innerHTML = `<div class="panel-header">Viewport</div><div class="panel-body"></div>`;

  const canvas = document.createElement('canvas');
  canvas.width = 200;
  canvas.height = 200;
  const body = el.querySelector('.panel-body');
  body.appendChild(canvas);

  const instance = new Instance();
  const gizmos = new TransformGizmos(canvas);
  gizmos.attach(instance);

  // expose for tests
  window.viewport = { canvas, gizmos, instance };

  return el;
}
