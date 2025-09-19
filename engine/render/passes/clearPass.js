export default class ClearPass {
  constructor(device, getView, color = { r: 0.0, g: 0.0, b: 0.0, a: 1.0 }) {
    this.device = device;
    this.getView = getView;
    this.color = color;
  }

  execute(encoder) {
    const view = this.getView ? this.getView() : null;
    if (!view) {
      return;
    }
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view,
          clearValue: this.color,
          loadOp: 'clear',
          storeOp: 'store'
        }
      ]
    });
    pass.end();
  }
}

