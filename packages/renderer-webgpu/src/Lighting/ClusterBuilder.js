export default class ClusterBuilder {
  constructor({ tileSize = 64, zSlices = 16 } = {}) {
    this.tileSize = tileSize;
    this.zSlices = zSlices;

    this.sliceZBounds = new Float32Array(zSlices + 1);
    this.xSlices = 0;
    this.ySlices = 0;
    this.width = 0;
    this.height = 0;
    this.near = 0.1;
    this.far = 100.0;
    this.fov = Math.PI / 2;
    this.aspect = 1.0;

    this.numClusters = 0;
    this.clusterData = null; // Uint32Array storing offset,count pairs
    this.clusterIndices = null; // Uint32Array storing light indices
  }

  /**
   * Update grid dimensions and compute depth slice boundaries.
   * Must be called when viewport or camera parameters change.
   */
  update({ width, height, near, far, fov, aspect }) {
    this.width = width;
    this.height = height;
    this.near = near;
    this.far = far;
    this.fov = fov;
    this.aspect = aspect;

    this.xSlices = Math.ceil(width / this.tileSize);
    this.ySlices = Math.ceil(height / this.tileSize);
    this.numClusters = this.xSlices * this.ySlices * this.zSlices;

    this._computeSliceBounds();
  }

  _computeSliceBounds() {
    const logRatio = Math.log(this.far / this.near);
    for (let i = 0; i <= this.zSlices; i++) {
      this.sliceZBounds[i] = this.near * Math.exp((logRatio * i) / this.zSlices);
    }
  }

  /**
   * Convert a depth value in view space to a z slice index.
   */
  _zSliceFromDepth(depth) {
    const clamped = Math.min(Math.max(depth, this.near), this.far);
    const logRatio = Math.log(this.far / this.near);
    const slice = Math.floor(
      (Math.log(clamped / this.near) / logRatio) * this.zSlices
    );
    return Math.min(Math.max(slice, 0), this.zSlices - 1);
  }

  /**
   * Build cluster data for an array of lights.
   * Lights should be in view space with { position:[x,y,z], radius }.
   */
  build(lights) {
    const clusters = new Array(this.numClusters);
    for (let i = 0; i < this.numClusters; i++) clusters[i] = [];

    const tanFovY = Math.tan(this.fov * 0.5);
    const tanFovX = tanFovY * this.aspect;
    const tileWidth = this.width / this.xSlices;
    const tileHeight = this.height / this.ySlices;

    for (let i = 0; i < lights.length; i++) {
      const l = lights[i];
      const lx = l.position[0];
      const ly = l.position[1];
      const lz = l.position[2];
      const r = l.radius;
      const z = -lz; // camera forward is -Z
      if (z <= 0) continue;

      const minZ = this._zSliceFromDepth(z - r);
      const maxZ = this._zSliceFromDepth(z + r);

      const minXNorm = ((lx - r) / -lz) / tanFovX;
      const maxXNorm = ((lx + r) / -lz) / tanFovX;
      const minYNorm = ((ly - r) / -lz) / tanFovY;
      const maxYNorm = ((ly + r) / -lz) / tanFovY;

      const minX = Math.floor((minXNorm * 0.5 + 0.5) * this.width / tileWidth);
      const maxX = Math.floor((maxXNorm * 0.5 + 0.5) * this.width / tileWidth);
      const minY = Math.floor((minYNorm * 0.5 + 0.5) * this.height / tileHeight);
      const maxY = Math.floor((maxYNorm * 0.5 + 0.5) * this.height / tileHeight);

      const xs = Math.min(this.xSlices - 1, Math.max(0, minX));
      const xe = Math.min(this.xSlices - 1, Math.max(0, maxX));
      const ys = Math.min(this.ySlices - 1, Math.max(0, minY));
      const ye = Math.min(this.ySlices - 1, Math.max(0, maxY));

      for (let zIdx = minZ; zIdx <= maxZ; zIdx++) {
        for (let yIdx = ys; yIdx <= ye; yIdx++) {
          for (let xIdx = xs; xIdx <= xe; xIdx++) {
            const idx =
              xIdx + yIdx * this.xSlices + zIdx * this.xSlices * this.ySlices;
            clusters[idx].push(i);
          }
        }
      }
    }

    const indices = [];
    const clusterData = new Uint32Array(this.numClusters * 2);
    let offset = 0;
    for (let i = 0; i < this.numClusters; i++) {
      const arr = clusters[i];
      clusterData[i * 2] = offset;
      clusterData[i * 2 + 1] = arr.length;
      for (const li of arr) indices.push(li);
      offset += arr.length;
    }

    this.clusterData = clusterData;
    this.clusterIndices = new Uint32Array(indices);

    return { clusterData: this.clusterData, clusterIndices: this.clusterIndices };
  }
}
