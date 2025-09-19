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
    const swapChainView = this.context.getCurrentTexture().createView();
    const context = { swapChainView };
    for (const pass of this.passes) {
      pass.execute(encoder, context);
    }
    this.device.queue.submit([encoder.finish()]);
  }
}

