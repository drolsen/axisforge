// Simple script editor panel with text area bound to a ScriptContext.
export default function ScriptEditorPanel(context, name = 'Main') {
  const el = document.createElement('div');
  el.id = 'script-editor-panel';
  el.className = 'panel';
  el.innerHTML = `
    <div class="panel-header">Script Editor</div>
    <div class="panel-body">
      <textarea style="width:100%;height:100%;"></textarea>
    </div>
  `;
  const textarea = el.querySelector('textarea');
  textarea.addEventListener('input', () => {
    context.load(name, textarea.value);
  });
  return el;
}
