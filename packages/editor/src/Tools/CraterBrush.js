export default class CraterBrush {
  constructor(masks) {
    this.masks = masks;
    this.queue = [];
  }

  // Enqueue a crater impact
  add(x, y, radius, depth = 1) {
    this.queue.push({ x, y, radius, depth });
  }

  // Apply all queued impacts to the destruction masks
  flush() {
    for (const impact of this.queue) {
      this.masks.applyCrater(impact.x, impact.y, impact.radius, impact.depth);
    }
    this.queue.length = 0;
  }
}
