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
    this.root.appendChild(this._createToggle('SSAO', {
      initial: Boolean(PostFXSettings.ssao),
      onChange: value => {
        PostFXSettings.ssao = value;
      },
    }));
    this.root.appendChild(this._createSlider('SSAO Radius', {
      min: 0.05,
      max: 2.0,
      step: 0.05,
      initial: Number(PostFXSettings.ssaoRadius) || 0.5,
      format: value => value.toFixed(2),
      onChange: value => {
        PostFXSettings.ssaoRadius = value;
      },
    }));
    this.root.appendChild(this._createSlider('SSAO Intensity', {
      min: 0.1,
      max: 4.0,
      step: 0.1,
      initial: Number(PostFXSettings.ssaoIntensity) || 1.0,
      format: value => value.toFixed(2),
      onChange: value => {
        PostFXSettings.ssaoIntensity = value;
      },
    }));
    this.root.appendChild(this._createToggle('SSAO High Quality', {
      initial: Boolean(PostFXSettings.ssaoHighQuality),
      onChange: value => {
        PostFXSettings.ssaoHighQuality = value;
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

  _createSlider(labelText, {
    min = 0,
    max = 1,
    step = 0.1,
    initial = 0,
    format = value => value.toFixed(2),
    onChange,
  } = {}) {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '4px';
    container.style.marginBottom = '8px';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';

    const label = document.createElement('span');
    label.textContent = labelText;

    const valueLabel = document.createElement('span');
    valueLabel.textContent = format(initial);

    header.appendChild(label);
    header.appendChild(valueLabel);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(initial);

    const updateValue = () => {
      const parsed = Number(input.value);
      const clamped = Math.min(max, Math.max(min, parsed));
      valueLabel.textContent = format(clamped);
      if (typeof onChange === 'function') {
        onChange(clamped);
      }
    };

    input.addEventListener('input', updateValue);
    updateValue();

    container.appendChild(header);
    container.appendChild(input);
    return container;
  }
}
