import ScriptContext from '/packages/runtime-core/src/scripting/ScriptContext.js';

/** Simple code editor panel with a textarea. When a script instance with a
 * `Source` property is selected the code can be edited and executed through a
 * ScriptContext. Only instances marked with `Kind: "Client"` are hot reloaded.
 */
export default class CodePanel {
  constructor(container, context = new ScriptContext()) {
    this.container = container;
    this.context = context;
    this.instance = null;
    this.render();
  }

  setInstance(inst) {
    this.instance = inst;
    this.render();
    if (inst && inst.properties.Source && inst.properties.Kind === 'Client') {
      this.context.setScript(inst.properties.Name, inst.properties.Source);
    }
  }

  render() {
    this.container.innerHTML = '';
    const title = document.createElement('div');
    title.textContent = 'Code';
    title.className = 'panel-title';
    this.container.appendChild(title);

    const body = document.createElement('div');
    body.className = 'panel-body';
    body.style.height = '100%';
    body.style.display = 'flex';
    body.style.flexDirection = 'column';

    if (!this.instance || !this.instance.properties.Source) {
      body.textContent = 'No script selected';
      this.container.appendChild(body);
      return;
    }

    const note = document.createElement('div');
    if (this.instance.properties.Kind === 'Server') {
      note.textContent = 'Server script – changes require restart';
    } else {
      note.textContent = 'Client script – edits run immediately';
    }
    note.style.marginBottom = '4px';
    body.appendChild(note);

    const textarea = document.createElement('textarea');
    textarea.value = this.instance.properties.Source;
    textarea.style.flex = '1';
    textarea.style.width = '100%';
    textarea.style.fontFamily = 'monospace';
    textarea.addEventListener('input', () => {
      this.instance.setProperty('Source', textarea.value);
      if (this.instance.properties.Kind === 'Client') {
        this.context.setScript(this.instance.properties.Name, textarea.value);
      }
    });
    body.appendChild(textarea);

    this.container.appendChild(body);
  }
}
