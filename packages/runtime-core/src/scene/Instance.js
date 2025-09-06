export default class Instance {
  constructor() {
    // 4x4 transformation matrix stored in column-major order
    this._transform = [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ];
  }

  setTransform(matrix) {
    if (!Array.isArray(matrix) || matrix.length !== 16) {
      throw new Error('Transform must be an array of 16 numbers');
    }
    this._transform = matrix.slice();
  }

  getTransform() {
    return this._transform.slice();
  }
}
