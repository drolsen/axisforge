export default class DestructionMasks {
  constructor(width = 64, height = 64) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
  }

  // Fill entire mask with a color [r,g,b,a]
  fill(color = [0, 0, 0, 255]) {
    for (let i = 0; i < this.data.length; i += 4) {
      this.data[i] = color[0];
      this.data[i + 1] = color[1];
      this.data[i + 2] = color[2];
      this.data[i + 3] = color[3];
    }
  }

  // Paint RGBA brush into mask
  applyBrush(x, y, radius, color) {
    const r2 = radius * radius;
    for (let j = 0; j < this.height; j++) {
      for (let i = 0; i < this.width; i++) {
        const dx = i - x;
        const dy = j - y;
        if (dx * dx + dy * dy <= r2) {
          const idx = (j * this.width + i) * 4;
          this.data[idx] = color[0];
          this.data[idx + 1] = color[1];
          this.data[idx + 2] = color[2];
          this.data[idx + 3] = color[3];
        }
      }
    }
  }
}
