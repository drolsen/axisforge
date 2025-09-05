export class UDim {
  constructor(scale = 0, offset = 0) {
    this.scale = scale;
    this.offset = offset;
  }

  add(other) {
    return new UDim(this.scale + other.scale, this.offset + other.offset);
  }

  sub(other) {
    return new UDim(this.scale - other.scale, this.offset - other.offset);
  }

  mul(value) {
    return new UDim(this.scale * value, this.offset * value);
  }

  div(value) {
    return new UDim(this.scale / value, this.offset / value);
  }

  resolve(container) {
    return this.scale * container + this.offset;
  }
}

export default UDim;
