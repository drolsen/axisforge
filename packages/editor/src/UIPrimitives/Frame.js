import UDim2 from '../../../ui/src/UDim2.js';

export default class Frame {
  constructor({ position = new UDim2(), size = new UDim2(), backgroundColor = 'transparent' } = {}) {
    this.position = position;
    this.size = size;
    this.backgroundColor = backgroundColor;
    this.children = [];
    this.element = document.createElement('div');
    this.stroke = null;
    this.corner = null;
    this.sizeConstraint = null;
  }

  appendChild(child) {
    this.children.push(child);
    this.element.appendChild(child.element);
  }
}
