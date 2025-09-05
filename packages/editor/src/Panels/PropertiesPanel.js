export default function PropertiesPanel() {
  const el = document.createElement('div');
  el.id = 'properties-panel';
  el.className = 'panel';
  el.innerHTML = `<div class="panel-header">Properties</div><div class="panel-body"></div>`;
  return el;
}
