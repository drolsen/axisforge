/**
 * Explorer panel displays a simple tree of instances. Instances are basic
 * observable objects with a name and property bag. The panel emits a `select`
 * callback when an instance is clicked.
 */
export default class ExplorerPanel {
  constructor(container, instances = []) {
    this.container = container;
    this.instances = instances;
    this.selectHandlers = [];
    this.render();
  }

  static createDefaultInstances() {
    return [
      new Instance('Workspace'),
      new Instance('ServerScript', {
        Source: "console.log('server script loaded')",
        Kind: 'Server'
      }),
      new Instance('ClientScript', {
        Source: "console.log('hello client')",
        Kind: 'Client'
      }),
      new Instance('SharedStorage')
    ];
  }

  onSelect(fn) {
    this.selectHandlers.push(fn);
  }

  render() {
    this.container.innerHTML = '';
    const title = document.createElement('div');
    title.textContent = 'Explorer';
    title.className = 'panel-title';
    this.container.appendChild(title);

    const body = document.createElement('div');
    body.className = 'panel-body';
    const ul = document.createElement('ul');
    ul.style.listStyle = 'none';
    ul.style.padding = '0';

    for (const inst of this.instances) {
      const li = document.createElement('li');
      li.textContent = inst.properties.Name;
      li.style.padding = '2px 4px';
      li.style.cursor = 'pointer';
      li.addEventListener('click', () => {
        this.selectHandlers.forEach(h => h(inst));
      });
      inst.addEventListener('change', e => {
        if (e.detail.key === 'Name') li.textContent = e.detail.value;
      });
      ul.appendChild(li);
    }
    body.appendChild(ul);
    this.container.appendChild(body);
  }
}

/** Simple observable instance used by the editor panels */
export class Instance extends EventTarget {
  constructor(name, props = {}) {
    super();
    this.properties = { Name: name, ...props };
  }

  setProperty(key, value) {
    this.properties[key] = value;
    this.dispatchEvent(new CustomEvent('change', { detail: { key, value } }));
  }
}
