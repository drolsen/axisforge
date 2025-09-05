/**
 * Properties panel lists properties of the selected instance and allows live
 * editing. Updates propagate back to the instance through the Instance API.
 */
export default class PropertiesPanel {
  constructor(container) {
    this.container = container;
    this.instance = null;
    this.render();
  }

  setInstance(inst) {
    this.instance = inst;
    this.render();
  }

  render() {
    this.container.innerHTML = '';
    const title = document.createElement('div');
    title.textContent = 'Properties';
    title.className = 'panel-title';
    this.container.appendChild(title);

    const body = document.createElement('div');
    body.className = 'panel-body';
    if (!this.instance) {
      body.textContent = 'No selection';
      this.container.appendChild(body);
      return;
    }

    for (const [key, value] of Object.entries(this.instance.properties)) {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.marginBottom = '4px';

      const label = document.createElement('label');
      label.textContent = key;
      label.style.width = '80px';
      row.appendChild(label);

      const input = document.createElement('input');
      input.value = value;
      input.style.flex = '1';
      input.addEventListener('input', () => {
        this.instance.setProperty(key, input.value);
      });
      // Live binding - update if instance property changes elsewhere
      this.instance.addEventListener('change', e => {
        if (e.detail.key === key && document.activeElement !== input) {
          input.value = e.detail.value;
        }
      });
      row.appendChild(input);
      body.appendChild(row);
    }

    this.container.appendChild(body);
  }
}
