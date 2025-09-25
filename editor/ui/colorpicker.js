const SV_SIZE = { width: 180, height: 140 };
const HUE_SIZE = { width: 180, height: 16 };

function clamp01(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  if (num <= 0) return 0;
  if (num >= 1) return 1;
  return num;
}

function hsvToRgb(h, s, v) {
  const hh = ((h % 1) + 1) % 1;
  const ss = clamp01(s);
  const vv = clamp01(v);
  const i = Math.floor(hh * 6);
  const f = hh * 6 - i;
  const p = vv * (1 - ss);
  const q = vv * (1 - f * ss);
  const t = vv * (1 - (1 - f) * ss);
  switch (i % 6) {
    case 0: return { r: vv, g: t, b: p };
    case 1: return { r: q, g: vv, b: p };
    case 2: return { r: p, g: vv, b: t };
    case 3: return { r: p, g: q, b: vv };
    case 4: return { r: t, g: p, b: vv };
    case 5:
    default:
      return { r: vv, g: p, b: q };
  }
}

function rgbToHsv(r, g, b) {
  const rr = clamp01(r);
  const gg = clamp01(g);
  const bb = clamp01(b);
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === rr) {
      h = (gg - bb) / delta + (gg < bb ? 6 : 0);
    } else if (max === gg) {
      h = (bb - rr) / delta + 2;
    } else {
      h = (rr - gg) / delta + 4;
    }
    h /= 6;
  }
  const s = max === 0 ? 0 : delta / max;
  return { h, s, v: max };
}

function componentToHex(value) {
  const num = Math.round(clamp01(value) * 255);
  const hex = num.toString(16).padStart(2, '0');
  return hex.toUpperCase();
}

function rgbToHex({ r, g, b }) {
  return `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`;
}

function hexToRgb(hex) {
  if (typeof hex !== 'string') return null;
  let value = hex.trim();
  if (!value) return null;
  if (value.startsWith('#')) value = value.slice(1);
  if (value.length === 3) {
    value = value.split('').map(ch => ch + ch).join('');
  }
  if (value.length !== 6 || /[^0-9a-fA-F]/.test(value)) {
    return null;
  }
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  return { r, g, b };
}

function setCanvasSize(canvas, width, height) {
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
}

class ColorPicker {
  constructor({ color = { r: 1, g: 1, b: 1 }, onChange = null } = {}) {
    this._onChange = typeof onChange === 'function' ? onChange : null;
    this._hsv = { h: 0, s: 0, v: 1 };
    this._rgb = { r: 1, g: 1, b: 1 };

    this.element = document.createElement('div');
    this.element.className = 'colorpicker';

    this.svContainer = document.createElement('div');
    this.svContainer.className = 'colorpicker__sv';
    this.svCanvas = document.createElement('canvas');
    this.svCanvas.className = 'colorpicker__sv-canvas';
    setCanvasSize(this.svCanvas, SV_SIZE.width, SV_SIZE.height);
    this.svThumb = document.createElement('div');
    this.svThumb.className = 'colorpicker__sv-thumb';
    this.svContainer.append(this.svCanvas, this.svThumb);

    this.hueContainer = document.createElement('div');
    this.hueContainer.className = 'colorpicker__hue';
    this.hueCanvas = document.createElement('canvas');
    this.hueCanvas.className = 'colorpicker__hue-canvas';
    setCanvasSize(this.hueCanvas, HUE_SIZE.width, HUE_SIZE.height);
    this.hueThumb = document.createElement('div');
    this.hueThumb.className = 'colorpicker__hue-thumb';
    this.hueContainer.append(this.hueCanvas, this.hueThumb);

    this.preview = document.createElement('div');
    this.preview.className = 'colorpicker__preview';

    this.hexInput = document.createElement('input');
    this.hexInput.className = 'colorpicker__hex';
    this.hexInput.type = 'text';
    this.hexInput.placeholder = '#FFFFFF';
    this.hexInput.maxLength = 7;
    this.hexInput.autocomplete = 'off';
    this.hexInput.spellcheck = false;

    const controls = document.createElement('div');
    controls.className = 'colorpicker__controls';
    controls.append(this.preview, this.hexInput);

    this.element.append(this.svContainer, this.hueContainer, controls);

    this._renderHueCanvas();
    this.setColor(color, { silent: true });
    this._render();

    this._bindEvents();
  }

  getElement() {
    return this.element;
  }

  getColor() {
    return { ...this._rgb };
  }

  setColor(color, { silent = false } = {}) {
    if (!color) return;
    const next = {
      r: clamp01(color.r ?? 0),
      g: clamp01(color.g ?? 0),
      b: clamp01(color.b ?? 0),
    };
    this._rgb = next;
    this._hsv = rgbToHsv(next.r, next.g, next.b);
    this._render();
    if (!silent) {
      this._emit();
    }
  }

  setOnChange(handler) {
    this._onChange = typeof handler === 'function' ? handler : null;
  }

  dispose() {
    // Event listeners rely on DOM removal; ensure references cleared.
    this._onChange = null;
  }

  _bindEvents() {
    this.svCanvas.addEventListener('pointerdown', event => {
      event.preventDefault();
      try {
        this.svCanvas.setPointerCapture(event.pointerId);
      } catch {}
      this._handleSVPointer(event);
      const move = e => this._handleSVPointer(e);
      const up = () => {
        try {
          this.svCanvas.releasePointerCapture(event.pointerId);
        } catch {}
        this.svCanvas.removeEventListener('pointermove', move);
        this.svCanvas.removeEventListener('pointerup', up);
        this.svCanvas.removeEventListener('pointercancel', up);
      };
      this.svCanvas.addEventListener('pointermove', move);
      this.svCanvas.addEventListener('pointerup', up);
      this.svCanvas.addEventListener('pointercancel', up);
    });

    this.hueCanvas.addEventListener('pointerdown', event => {
      event.preventDefault();
      try {
        this.hueCanvas.setPointerCapture(event.pointerId);
      } catch {}
      this._handleHuePointer(event);
      const move = e => this._handleHuePointer(e);
      const up = () => {
        try {
          this.hueCanvas.releasePointerCapture(event.pointerId);
        } catch {}
        this.hueCanvas.removeEventListener('pointermove', move);
        this.hueCanvas.removeEventListener('pointerup', up);
        this.hueCanvas.removeEventListener('pointercancel', up);
      };
      this.hueCanvas.addEventListener('pointermove', move);
      this.hueCanvas.addEventListener('pointerup', up);
      this.hueCanvas.addEventListener('pointercancel', up);
    });

    this.hexInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this._commitHex();
      }
    });
    this.hexInput.addEventListener('blur', () => this._commitHex());
  }

  _commitHex() {
    const value = this.hexInput.value.trim();
    const rgb = hexToRgb(value);
    if (!rgb) {
      this.hexInput.value = rgbToHex(this._rgb);
      return;
    }
    this._rgb = {
      r: clamp01(rgb.r),
      g: clamp01(rgb.g),
      b: clamp01(rgb.b),
    };
    this._hsv = rgbToHsv(this._rgb.r, this._rgb.g, this._rgb.b);
    this._render();
    this._emit();
  }

  _emit() {
    if (this._onChange) {
      this._onChange(this.getColor());
    }
  }

  _handleSVPointer(event) {
    const rect = this.svCanvas.getBoundingClientRect();
    const x = clamp01((event.clientX - rect.left) / rect.width);
    const y = clamp01((event.clientY - rect.top) / rect.height);
    this._hsv.s = x;
    this._hsv.v = 1 - y;
    this._rgb = hsvToRgb(this._hsv.h, this._hsv.s, this._hsv.v);
    this._render(false);
    this._emit();
  }

  _handleHuePointer(event) {
    const rect = this.hueCanvas.getBoundingClientRect();
    const x = clamp01((event.clientX - rect.left) / rect.width);
    this._hsv.h = x;
    this._rgb = hsvToRgb(this._hsv.h, this._hsv.s, this._hsv.v);
    this._render();
    this._emit();
  }

  _render(shouldUpdateCanvas = true) {
    if (shouldUpdateCanvas) {
      this._renderSVCanvas();
    }
    this._updateThumbs();
    const hex = rgbToHex(this._rgb);
    this.preview.style.backgroundColor = hex;
    if (document.activeElement !== this.hexInput) {
      this.hexInput.value = hex;
    }
  }

  _renderHueCanvas() {
    const ctx = this.hueCanvas.getContext('2d', { alpha: false });
    const { width, height } = this.hueCanvas;
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    const stops = [
      { stop: 0, color: '#FF0000' },
      { stop: 1 / 6, color: '#FFFF00' },
      { stop: 2 / 6, color: '#00FF00' },
      { stop: 3 / 6, color: '#00FFFF' },
      { stop: 4 / 6, color: '#0000FF' },
      { stop: 5 / 6, color: '#FF00FF' },
      { stop: 1, color: '#FF0000' },
    ];
    for (const entry of stops) {
      gradient.addColorStop(entry.stop, entry.color);
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  _renderSVCanvas() {
    const ctx = this.svCanvas.getContext('2d', { alpha: false });
    const { width, height } = this.svCanvas;
    const hueColor = hsvToRgb(this._hsv.h, 1, 1);
    const gradientX = ctx.createLinearGradient(0, 0, width, 0);
    gradientX.addColorStop(0, '#FFFFFF');
    gradientX.addColorStop(1, rgbToHex(hueColor));
    ctx.fillStyle = gradientX;
    ctx.fillRect(0, 0, width, height);

    const gradientY = ctx.createLinearGradient(0, 0, 0, height);
    gradientY.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradientY.addColorStop(1, 'rgba(0, 0, 0, 1)');
    ctx.fillStyle = gradientY;
    ctx.fillRect(0, 0, width, height);
  }

  _updateThumbs() {
    const { s, v, h } = this._hsv;
    this.svThumb.style.left = `${s * 100}%`;
    this.svThumb.style.top = `${(1 - v) * 100}%`;
    this.hueThumb.style.left = `${h * 100}%`;
  }
}

export { rgbToHex, hexToRgb, hsvToRgb, rgbToHsv };
export default ColorPicker;
