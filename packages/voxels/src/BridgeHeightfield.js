export default class BridgeHeightfield {
  constructor() {
    this.terrain = null;
    this.voxels = null;
    this.beltWidth = 1;
    this.mask = null;
  }

  setup({ terrain, voxels, beltWidth = 1 }) {
    this.terrain = terrain;
    this.voxels = voxels;
    this.beltWidth = beltWidth;

    // Simple 1D mask placeholder for belt region
    const size = terrain?.size || 1;
    this.mask = new Float32Array(size * size);
    for (let i = 0; i < this.mask.length; i++) {
      const x = i % size;
      const y = Math.floor(i / size);
      const edge = Math.min(x, y, size - 1 - x, size - 1 - y);
      const t = Math.max(0, Math.min(1, edge / beltWidth));
      this.mask[i] = t;
    }
  }

  render(passCtx) {
    if (!this.terrain || !this.voxels) return;
    if (this.terrain.render) this.terrain.render(passCtx, { mask: this.mask });
    if (this.voxels.render) this.voxels.render(passCtx);
  }
}
