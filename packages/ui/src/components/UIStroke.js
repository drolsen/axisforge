export class UIStroke {
  constructor(color = 'black', thickness = 1) {
    this.color = color;
    this.thickness = thickness;
  }

  apply(frame) {
    frame.element.style.boxSizing = 'border-box';
    frame.element.style.border = `${this.thickness}px solid ${this.color}`;
  }
}

export default UIStroke;
