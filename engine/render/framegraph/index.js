export default class FrameGraph {
  constructor(device, context) {
    this.device = device;
    this.context = context;
    this.passes = [];
  }

  addPass(pass) {
    this.passes.push(pass);
  }

  async init() {
    for (const pass of this.passes) {
      if (pass.init) {
        await pass.init();
      }
    }
  }

  render() {
    const encoder = this.device.createCommandEncoder();
    const view = this.context.getCurrentTexture().createView();
    for (const pass of this.passes) {
      pass.execute(encoder, view);
    }
    this.device.queue.submit([encoder.finish()]);
  }
}

