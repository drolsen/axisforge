export default class FrameGraph {
  constructor() {
    this.passes = [];
  }

  addPass(pass) {
    this.passes.push(pass);
  }

  render(ctx) {
    for (const pass of this.passes) {
      pass(ctx);
    }
  }
}
