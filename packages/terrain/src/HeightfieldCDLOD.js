export default class HeightfieldCDLOD {
  constructor({ lodRanges = [50, 100, 200, 400] } = {}) {
    this.lodRanges = lodRanges;
  }

  // Determine LOD index based on distance
  getLOD(dist) {
    for (let i = 0; i < this.lodRanges.length; i++) {
      if (dist < this.lodRanges[i]) return i;
    }
    return this.lodRanges.length - 1;
  }

  // Simple morph factor between current and next LOD
  getMorph(dist) {
    for (let i = 0; i < this.lodRanges.length; i++) {
      const start = i === 0 ? 0 : this.lodRanges[i - 1];
      const end = this.lodRanges[i];
      if (dist >= start && dist < end) {
        const span = end - start;
        const t = (dist - start) / span;
        return { lod: i, morph: t };
      }
    }
    const lastStart = this.lodRanges[this.lodRanges.length - 2];
    const lastEnd = this.lodRanges[this.lodRanges.length - 1];
    const span = lastEnd - lastStart;
    const t = (dist - lastStart) / span;
    return { lod: this.lodRanges.length - 1, morph: Math.min(1, Math.max(0, t)) };
  }

  // Generate placeholder geometry with skirts
  generateGeometry(size = 1) {
    // Return simple plane vertices including skirts
    const half = size / 2;
    return {
      vertices: [
        // main quad
        [-half, 0, -half],
        [half, 0, -half],
        [half, 0, half],
        [-half, 0, half],
        // skirts (extend downward)
        [-half, -0.1, -half],
        [half, -0.1, -half],
        [half, -0.1, half],
        [-half, -0.1, half]
      ]
    };
  }
}
