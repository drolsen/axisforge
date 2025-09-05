import { UISizeConstraint } from './components/UISizeConstraint.js';

export class LayoutEngine {
  constructor(root) {
    this.root = root;
    this.frames = [];
    if (this.root) {
      this.root.style.position = 'relative';
    }
  }

  add(frame, parent = null) {
    const container = parent ? parent.element : this.root;
    if (!container) throw new Error('No root element provided');
    container.appendChild(frame.element);
    (parent ? parent.children : this.frames).push(frame);
  }

  update() {
    const rootWidth = this.root.clientWidth;
    const rootHeight = this.root.clientHeight;

    const layout = (frame, pw, ph) => {
      let { x, y } = frame.position.resolve(pw, ph);
      let { x: w, y: h } = frame.size.resolve(pw, ph);

      for (const comp of frame.components) {
        if (comp instanceof UISizeConstraint) {
          const constrained = comp.apply(w, h);
          w = constrained.width;
          h = constrained.height;
        }
      }

      const ax = frame.anchorPoint.x || 0;
      const ay = frame.anchorPoint.y || 0;
      frame.element.style.position = 'absolute';
      frame.element.style.left = `${x - ax * w}px`;
      frame.element.style.top = `${y - ay * h}px`;
      frame.element.style.width = `${w}px`;
      frame.element.style.height = `${h}px`;

      for (const child of frame.children) {
        layout(child, w, h);
      }
    };

    for (const frame of this.frames) {
      layout(frame, rootWidth, rootHeight);
    }
  }
}

export default LayoutEngine;
