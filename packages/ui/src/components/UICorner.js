export class UICorner {
  constructor(radius = 0) {
    this.radius = radius;
  }

  apply(frame) {
    frame.element.style.borderRadius = `${this.radius}px`;
  }
}

export default UICorner;
