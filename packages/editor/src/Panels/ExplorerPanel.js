export default function ExplorerPanel() {
  const el = document.createElement('div');
  el.id = 'explorer-panel';
  el.className = 'panel';
  el.innerHTML = `<div class="panel-header">Explorer</div><div class="panel-body"></div>`;
  return el;
}
