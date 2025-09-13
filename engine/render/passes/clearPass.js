export default class ClearPass {
  constructor(device, color = { r: 0.0, g: 0.0, b: 0.0, a: 1.0 }) {
    this.device = device;
    this.color = color;
  }

  execute(encoder, view) {
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

