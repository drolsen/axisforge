export default function ConsolePanel() {
  const el = document.createElement('div');
  el.id = 'console-panel';
  el.className = 'panel';
  el.innerHTML = `<div class="panel-header">Console</div><div class="panel-body"></div>`;
  return el;
}
