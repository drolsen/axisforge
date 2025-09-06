export default class TransformGizmos {
  constructor(canvas) {
    this.canvas = canvas;
    this.mode = 'translate';
    this.snap = 0;
    this.instance = null;
  }

  attach(instance) {
    this.instance = instance;
    this.render();
  }

  setMode(mode) {
    this.mode = mode;
  }

  setSnap(value) {
    this.snap = value;
  }

  _applySnap(value) {
    if (!this.snap) return value;
    return Math.round(value / this.snap) * this.snap;
  }

  translate(x = 0, y = 0, z = 0) {
    if (!this.instance) return;
    const m = this.instance.getTransform();
    m[12] += this._applySnap(x);
    m[13] += this._applySnap(y);
    m[14] += this._applySnap(z);
    this.instance.setTransform(m);
    this.render();
  }

  rotate(/* radX, radY, radZ */) {
    // rotation not implemented for placeholder
  }

  scale(sx = 1, sy = 1, sz = 1) {
    if (!this.instance) return;
    const m = this.instance.getTransform();
    m[0] *= sx;
    m[5] *= sy;
    m[10] *= sz;
    this.instance.setTransform(m);
    this.render();
  }

  render() {
    if (!this.canvas || !this.instance) return;
    const ctx = this.canvas.getContext('2d');
    const m = this.instance.getTransform();
    const tx = m[12];
    const ty = m[13];
    const scale = m[0];
    const size = 40 * scale;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = '#eee';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = '#00f';
    ctx.fillRect(60 + tx * 100, 80 - ty * 100, size, size);
  }
}
