export default class HDRTarget {
  constructor(device, format = 'rgba16float') {
    this.device = device;
    this.format = format;
    this.texture = null;
    this.view = null;
    this.width = 0;
    this.height = 0;
  }

  resize(width, height) {
    const nextWidth = Math.max(1, Math.floor(width));
    const nextHeight = Math.max(1, Math.floor(height));
    if (this.texture && this.width === nextWidth && this.height === nextHeight) {
      return false;
    }
    this.width = nextWidth;
    this.height = nextHeight;
    if (this.texture) {
      this.texture.destroy();
    }
    this.texture = this.device.createTexture({
      size: { width: this.width, height: this.height },
      format: this.format,
      usage:
        GPUTextureUsage.RENDER_ATTACHMENT |
        GPUTextureUsage.TEXTURE_BINDING,
    });
    this.view = this.texture.createView();
    return true;
  }

  getView() {
    return this.view;
  }

  getSize() {
    return { width: this.width, height: this.height };
  }
}
