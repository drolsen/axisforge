import { PostFXSettings } from '../../engine/render/post/settings.js';
import { GetService } from '../../engine/core/index.js';

function formatTimeOfDay(value = 0) {
  if (!Number.isFinite(value)) {
    return '00:00';
  }
  let hours = value % 24;
  if (hours < 0) {
    hours += 24;
  }
  const wholeHours = Math.floor(hours);
  let minutes = Math.round((hours - wholeHours) * 60);
  let finalHours = wholeHours;
  if (minutes >= 60) {
    minutes -= 60;
    finalHours = (finalHours + 1) % 24;
  }
  const hh = String(finalHours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  return `${hh}:${mm}`;
}

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

    this.lighting = GetService('Lighting');
    this._lightingTimeApply = null;
    this._lightingTurbidityApply = null;
    this._lightingGroundApply = null;
    this._lightingScrubbing = false;
    this._lightingRaf = null;

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

    if (this.lighting) {
      this._setupLightingSection();
      this._scheduleLightingTick();
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
    onSetup,
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

    const applyValue = (rawValue, trigger = true) => {
      let parsed = rawValue;
      if (typeof parsed !== 'number') {
        parsed = Number(parsed);
      }
      if (!Number.isFinite(parsed)) {
        parsed = initial;
      }
      const clamped = Math.min(max, Math.max(min, parsed));
      input.value = String(clamped);
      valueLabel.textContent = format(clamped);
      if (trigger && typeof onChange === 'function') {
        onChange(clamped);
      }
      return clamped;
    };

    input.addEventListener('input', () => {
      applyValue(Number(input.value), true);
    });
    applyValue(initial, true);

    if (typeof onSetup === 'function') {
      onSetup({ container, input, valueLabel, applyValue });
    }

    container.appendChild(header);
    container.appendChild(input);
    return container;
  }

  _setupLightingSection() {
    this.root.appendChild(this._createSectionTitle('Lighting'));

    const timeSlider = this._createSlider('Time of Day', {
      min: 0,
      max: 24,
      step: 0.01,
      initial: this.lighting.getTimeOfDay?.() ?? 12,
      format: value => formatTimeOfDay(value),
      onChange: value => {
        if (this.lighting?.setTimeOfDay) {
          this.lighting.setTimeOfDay(value);
        }
      },
      onSetup: ({ input, applyValue }) => {
        this._lightingTimeApply = applyValue;
        const startScrub = () => { this._lightingScrubbing = true; };
        const stopScrub = () => { this._lightingScrubbing = false; };
        input.addEventListener('pointerdown', startScrub);
        input.addEventListener('pointerup', stopScrub);
        input.addEventListener('pointercancel', stopScrub);
        input.addEventListener('mouseleave', stopScrub);
      },
    });
    this.root.appendChild(timeSlider);

    const turbiditySlider = this._createSlider('Turbidity', {
      min: 1,
      max: 10,
      step: 0.1,
      initial: this.lighting.getTurbidity?.() ?? 2.5,
      format: value => value.toFixed(2),
      onChange: value => {
        if (this.lighting?.setTurbidity) {
          this.lighting.setTurbidity(value);
        }
      },
      onSetup: ({ applyValue }) => {
        this._lightingTurbidityApply = applyValue;
      },
    });
    this.root.appendChild(turbiditySlider);

    const groundInitial = (() => {
      const albedo = this.lighting.getGroundAlbedo?.();
      if (Array.isArray(albedo) && albedo.length >= 3) {
        return (albedo[0] + albedo[1] + albedo[2]) / 3;
      }
      return 0.2;
    })();

    const groundSlider = this._createSlider('Ground Albedo', {
      min: 0,
      max: 1,
      step: 0.01,
      initial: groundInitial,
      format: value => value.toFixed(2),
      onChange: value => {
        if (this.lighting?.setGroundAlbedo) {
          this.lighting.setGroundAlbedo([value, value, value]);
        }
      },
      onSetup: ({ applyValue }) => {
        this._lightingGroundApply = applyValue;
      },
    });
    this.root.appendChild(groundSlider);
  }

  _scheduleLightingTick() {
    if (this._lightingRaf != null) {
      cancelAnimationFrame(this._lightingRaf);
    }
    const tick = () => {
      this._updateLightingUI();
      this._lightingRaf = requestAnimationFrame(tick);
    };
    this._lightingRaf = requestAnimationFrame(tick);
  }

  _updateLightingUI() {
    if (!this.lighting) {
      return;
    }
    if (this._lightingTimeApply && !this._lightingScrubbing) {
      const time = this.lighting.getTimeOfDay?.();
      if (Number.isFinite(time)) {
        this._lightingTimeApply(time, false);
      }
    }
    if (this._lightingTurbidityApply) {
      const turbidity = this.lighting.getTurbidity?.();
      if (Number.isFinite(turbidity)) {
        this._lightingTurbidityApply(turbidity, false);
      }
    }
    if (this._lightingGroundApply) {
      const albedo = this.lighting.getGroundAlbedo?.();
      if (Array.isArray(albedo) && albedo.length >= 3) {
        const value = Math.max(0, Math.min(1, (albedo[0] + albedo[1] + albedo[2]) / 3));
        this._lightingGroundApply(value, false);
      }
    }
  }
}
