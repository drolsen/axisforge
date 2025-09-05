import { UDim } from './UDim.js';

export class UDim2 {
  constructor(scaleX = 0, offsetX = 0, scaleY = 0, offsetY = 0) {
    if (scaleX instanceof UDim) {
      this.x = scaleX;
      this.y = offsetX instanceof UDim ? offsetX : new UDim();
    } else {
      this.x = new UDim(scaleX, offsetX);
      this.y = new UDim(scaleY, offsetY);
    }
  }

  add(other) {
    return new UDim2(
      this.x.add(other.x),
      this.y.add(other.y)
    );
  }

  sub(other) {
    return new UDim2(
      this.x.sub(other.x),
      this.y.sub(other.y)
    );
  }

  mul(value) {
    return new UDim2(this.x.mul(value), this.y.mul(value));
  }

  div(value) {
    return new UDim2(this.x.div(value), this.y.div(value));
  }

  resolve(width, height) {
    return {
      x: this.x.resolve(width),
      y: this.y.resolve(height)
    };
  }
}

export default UDim2;
