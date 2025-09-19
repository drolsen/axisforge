import { PostFXSettings } from '../../engine/render/post/settings.js';

export default class SettingsPane {
  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'settings-pane';
    this.root.style.position = 'fixed';
    this.root.style.top = '12px';
    this.root.style.right = '12px';
    this.root.style.background = 'rgba(20, 20, 20, 0.85)';
    this.root.style.color = '#fff';
    this.root.style.padding = '12px';
    this.root.style.borderRadius = '6px';
    this.root.style.fontFamily = 'sans-serif';
    this.root.style.fontSize = '12px';
    this.root.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
    this.root.style.minWidth = '160px';

    const title = document.createElement('div');
    title.textContent = 'Post FX';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '8px';
    this.root.appendChild(title);

    this.root.appendChild(this._createToggle('ACES Tonemap', 'acesTonemap'));
    this.root.appendChild(this._createToggle('FXAA', 'fxaa'));

    document.body.appendChild(this.root);
  }

  _createToggle(labelText, key) {
    const container = document.createElement('label');
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.gap = '6px';
    container.style.marginBottom = '6px';
    container.style.cursor = 'pointer';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = Boolean(PostFXSettings[key]);
    checkbox.addEventListener('change', () => {
      PostFXSettings[key] = checkbox.checked;
    });

    const label = document.createElement('span');
    label.textContent = labelText;

    container.appendChild(checkbox);
    container.appendChild(label);
    return container;
  }
}
