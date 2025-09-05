export default function layout(frame) {
  const width = frame.size.x.toPixels(0);
  const height = frame.size.y.toPixels(0);
  frame.element.style.position = 'relative';
  frame.element.style.width = `${width}px`;
  frame.element.style.height = `${height}px`;
  layoutChildren(frame, { width, height });
}

function layoutChildren(frame, parentSize) {
  for (const child of frame.children) {
    let w = child.size.x.toPixels(parentSize.width);
    let h = child.size.y.toPixels(parentSize.height);

    if (child.sizeConstraint) {
      const c = child.sizeConstraint;
      w = Math.max(c.minWidth, Math.min(w, c.maxWidth));
      h = Math.max(c.minHeight, Math.min(h, c.maxHeight));
    }

    const x = child.position.x.toPixels(parentSize.width);
    const y = child.position.y.toPixels(parentSize.height);

    const el = child.element;
    el.style.position = 'absolute';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    if (child.backgroundColor) {
      el.style.backgroundColor = child.backgroundColor;
    }
    if (child.stroke) {
      el.style.boxSizing = 'border-box';
      el.style.border = `${child.stroke.thickness}px solid ${child.stroke.color}`;
    }
    if (child.corner) {
      el.style.borderRadius = `${child.corner.radius}px`;
    }
    layoutChildren(child, { width: w, height: h });
  }
}
