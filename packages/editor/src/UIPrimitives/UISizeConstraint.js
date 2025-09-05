export default class UISizeConstraint {
  constructor({ minWidth = 0, maxWidth = Infinity, minHeight = 0, maxHeight = Infinity } = {}) {
    this.minWidth = minWidth;
    this.maxWidth = maxWidth;
    this.minHeight = minHeight;
    this.maxHeight = maxHeight;
  }
}
