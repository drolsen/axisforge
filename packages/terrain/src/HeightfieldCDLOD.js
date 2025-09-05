export default class HeightfieldCDLOD {
  constructor({
    tileCount = 1,
    tileSize = 1,
    lodDistances = [],
    morphRange = 10,
    skirt = 1
  } = {}) {
    this.tileCount = tileCount;
    this.tileSize = tileSize;
    this.lodDistances = lodDistances;
    this.morphRange = morphRange;
    this.skirt = skirt;
    this.maxLevel = Math.max(0, lodDistances.length - 1);
    this.worldSize = tileCount * tileSize;
  }

  /**
   * Returns the LOD index for a given distance.
   */
  getLod(distance) {
    for (let i = 0; i < this.lodDistances.length; i++) {
      if (distance < this.lodDistances[i]) {
        return i;
      }
    }
    return this.lodDistances.length - 1;
  }

  /**
   * Computes morph factor between current and next LOD level.
   */
  morphFactor(distance, level) {
    const end = this.lodDistances[level];
    const start = end - this.morphRange;
    return Math.min(Math.max((distance - start) / this.morphRange, 0), 1);
  }

  /**
   * Selects tiles based on camera position using a quadtree.
   */
  selectTiles(camera) {
    const tiles = [];
    const self = this;
    function subdivide(x, y, size, level) {
      const cx = x + size / 2;
      const cy = y + size / 2;
      const dx = camera[0] - cx;
      const dy = camera[1] - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (level === self.maxLevel || dist > self.lodDistances[level]) {
        tiles.push({ x, y, size, level, morph: self.morphFactor(dist, level) });
      } else {
        const half = size / 2;
        const next = level + 1;
        subdivide(x, y, half, next);
        subdivide(x + half, y, half, next);
        subdivide(x, y + half, half, next);
        subdivide(x + half, y + half, half, next);
      }
    }
    subdivide(0, 0, this.worldSize, 0);
    return tiles;
  }

  /**
   * Generates vertices for a tile including skirts to hide cracks.
   */
  generateTileVertices(tile) {
    const { x, y, size } = tile;
    const h = -Math.abs(this.skirt);
    return [
      // top quad
      { position: [x, y], uv: [0, 0], skirt: 0 },
      { position: [x + size, y], uv: [1, 0], skirt: 0 },
      { position: [x + size, y + size], uv: [1, 1], skirt: 0 },
      { position: [x, y + size], uv: [0, 1], skirt: 0 },
      // skirt duplicated vertices
      { position: [x, y], uv: [0, 0], skirt: -h },
      { position: [x + size, y], uv: [1, 0], skirt: -h },
      { position: [x + size, y + size], uv: [1, 1], skirt: -h },
      { position: [x, y + size], uv: [0, 1], skirt: -h }
    ];
  }
}
