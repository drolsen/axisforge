export default class UDim {
  constructor(scale = 0, offset = 0) {
    this.scale = scale;
    this.offset = offset;
  }

  toPixels(base) {
    return this.scale * base + this.offset;
  }

  static add(a, b) {
    return new UDim(a.scale + b.scale, a.offset + b.offset);
  }

  static sub(a, b) {
    return new UDim(a.scale - b.scale, a.offset - b.offset);
  }

  static mul(a, b) {
    if (typeof b === 'number') {
      return new UDim(a.scale * b, a.offset * b);
    }
    if (typeof a === 'number') {
      return new UDim(a * b.scale, a * b.offset);
    }
    return new UDim(a.scale * b.scale, a.offset * b.offset);
  }

  static div(a, b) {
    if (typeof b === 'number') {
      return new UDim(a.scale / b, a.offset / b);
    }
    if (typeof a === 'number') {
      return new UDim(a / b.scale, a / b.offset);
    }
    return new UDim(a.scale / b.scale, a.offset / b.offset);
  }
}
