export default function ViewportPanel() {
  const el = document.createElement('div');
  el.id = 'viewport-panel';
  el.className = 'panel';
  el.innerHTML = `<div class="panel-header">Viewport</div><div class="panel-body"></div>`;
  return el;
}
