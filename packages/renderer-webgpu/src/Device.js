export class Device {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = null;
    this.adapter = null;
    this.device = null;
    this.features = new Set();
    this.limits = {};
    this.format = null;
  }

  async init() {
    if (typeof navigator === 'undefined' || !navigator.gpu) {
      throw new Error('WebGPU not supported');
    }

    this.adapter = await navigator.gpu.requestAdapter();
    if (!this.adapter) {
      throw new Error('Failed to acquire GPU adapter');
    }

    this.features = new Set(this.adapter.features);
    this.limits = { ...this.adapter.limits };
    this.device = await this.adapter.requestDevice();
    this.context = this.canvas.getContext('webgpu');
    this.format = navigator.gpu.getPreferredCanvasFormat();
    this.resize(this.canvas.clientWidth, this.canvas.clientHeight);
  }

  resize(width = this.canvas.clientWidth, height = this.canvas.clientHeight) {
    if (!this.context) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const w = Math.floor(width * dpr);
    const h = Math.floor(height * dpr);

    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.canvas.width = w;
    this.canvas.height = h;

    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'premultiplied',
    });
  }
}

export default Device;
