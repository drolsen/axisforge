import UDim from './UDim.js';

export default class UDim2 {
  constructor(a = 0, b = 0, c = 0, d = 0) {
    if (a instanceof UDim && b instanceof UDim) {
      this.x = a;
      this.y = b;
    } else {
      this.x = new UDim(a, b);
      this.y = new UDim(c, d);
    }
  }

  toPixels(widthBase, heightBase) {
    return {
      x: this.x.toPixels(widthBase),
      y: this.y.toPixels(heightBase),
    };
  }

  static add(a, b) {
    return new UDim2(UDim.add(a.x, b.x), UDim.add(a.y, b.y));
  }

  static sub(a, b) {
    return new UDim2(UDim.sub(a.x, b.x), UDim.sub(a.y, b.y));
  }
}
