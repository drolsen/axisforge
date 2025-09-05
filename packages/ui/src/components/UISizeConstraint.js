export class UISizeConstraint {
  constructor({ minX = 0, minY = 0, maxX = Infinity, maxY = Infinity } = {}) {
    this.minX = minX;
    this.minY = minY;
    this.maxX = maxX;
    this.maxY = maxY;
  }

  apply(width, height) {
    return {
      width: Math.max(this.minX, Math.min(width, this.maxX)),
      height: Math.max(this.minY, Math.min(height, this.maxY))
    };
  }
}

export default UISizeConstraint;
