import { PostFXSettings } from '../../engine/render/post/settings.js';

export default class SettingsPane {
  constructor({ profiler } = {}) {
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

    this.root.appendChild(this._createSectionTitle('Post FX'));
    this.root.appendChild(this._createToggle('ACES Tonemap', {
      initial: Boolean(PostFXSettings.acesTonemap),
      onChange: value => {
        PostFXSettings.acesTonemap = value;
      },
    }));
    this.root.appendChild(this._createToggle('FXAA', {
      initial: Boolean(PostFXSettings.fxaa),
      onChange: value => {
        PostFXSettings.fxaa = value;
      },
    }));

    if (profiler) {
      this.root.appendChild(this._createSectionTitle('Diagnostics'));
      this.root.appendChild(this._createToggle('Show Profiler', {
        initial: profiler.isVisible(),
        onChange: value => profiler.setVisible(value),
      }));
    }

    document.body.appendChild(this.root);
  }

  _createSectionTitle(text) {
    const title = document.createElement('div');
    title.textContent = text;
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '8px';
    if (this.root.children.length > 0) {
      title.style.marginTop = '12px';
    }
    return title;
  }

  _createToggle(labelText, { initial = false, onChange } = {}) {
    const container = document.createElement('label');
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.gap = '6px';
    container.style.marginBottom = '6px';
    container.style.cursor = 'pointer';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = Boolean(initial);
    if (typeof onChange === 'function') {
      checkbox.addEventListener('change', () => {
        onChange(checkbox.checked);
      });
    }

    const label = document.createElement('span');
    label.textContent = labelText;

    container.appendChild(checkbox);
    container.appendChild(label);
    return container;
  }
}
