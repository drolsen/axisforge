import { UDim2 } from '../UDim2.js';

export class Frame {
  constructor() {
    this.size = new UDim2();
    this.position = new UDim2();
    this.anchorPoint = { x: 0, y: 0 };
    this.element = document.createElement('div');
    this.element.style.position = 'absolute';
    this.children = [];
    this.components = [];
  }

  addChild(child) {
    this.children.push(child);
    this.element.appendChild(child.element);
    return child;
  }

  addComponent(component) {
    this.components.push(component);
    if (typeof component.apply === 'function') {
      component.apply(this);
    }
    return component;
  }
}

export default Frame;
