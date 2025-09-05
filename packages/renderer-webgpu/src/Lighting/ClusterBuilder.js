export class ClusterBuilder {
  constructor({ xSlices = 16, ySlices = 9, zSlices = 24 } = {}) {
    this.xSlices = xSlices;
    this.ySlices = ySlices;
    this.zSlices = zSlices;
    this.clusterCount = xSlices * ySlices * zSlices;
  }

  static _transformPoint(m, p) {
    // m is 4x4 column-major array (length 16)
    const x = p[0], y = p[1], z = p[2];
    return [
      m[0] * x + m[4] * y + m[8] * z + m[12],
      m[1] * x + m[5] * y + m[9] * z + m[13],
      m[2] * x + m[6] * y + m[10] * z + m[14],
    ];
  }

  build(camera, lights) {
    const { fov, aspect, near, far, viewMatrix } = camera;
    const tanFovY = Math.tan(0.5 * fov);
    const tanFovX = tanFovY * aspect;

    const clusterLists = Array.from({ length: this.clusterCount }, () => []);

    for (let i = 0; i < lights.length; i++) {
      const light = lights[i];
      let pos = light.position;
      if (viewMatrix) {
        pos = ClusterBuilder._transformPoint(viewMatrix, pos);
      }
      const radius = light.radius;
      const x = pos[0];
      const y = pos[1];
      const z = pos[2];
      const zc = -z; // camera looks down -Z
      if (zc - radius > far || zc + radius < near) {
        continue; // outside depth range
      }

      const xCenter = 0.5 + 0.5 * (x / (zc * tanFovX));
      const yCenter = 0.5 - 0.5 * (y / (zc * tanFovY));
      const radiusX = radius / (zc * tanFovX);
      const radiusY = radius / (zc * tanFovY);

      let minX = Math.floor((xCenter - radiusX) * this.xSlices);
      let maxX = Math.floor((xCenter + radiusX) * this.xSlices);
      let minY = Math.floor((yCenter - radiusY) * this.ySlices);
      let maxY = Math.floor((yCenter + radiusY) * this.ySlices);
      let minZ = Math.floor(((zc - radius - near) / (far - near)) * this.zSlices);
      let maxZ = Math.floor(((zc + radius - near) / (far - near)) * this.zSlices);

      minX = Math.max(0, Math.min(this.xSlices - 1, minX));
      maxX = Math.max(0, Math.min(this.xSlices - 1, maxX));
      minY = Math.max(0, Math.min(this.ySlices - 1, minY));
      maxY = Math.max(0, Math.min(this.ySlices - 1, maxY));
      minZ = Math.max(0, Math.min(this.zSlices - 1, minZ));
      maxZ = Math.max(0, Math.min(this.zSlices - 1, maxZ));

      if (minX > maxX || minY > maxY || minZ > maxZ) {
        continue;
      }

      for (let zcIdx = minZ; zcIdx <= maxZ; zcIdx++) {
        for (let ycIdx = minY; ycIdx <= maxY; ycIdx++) {
          for (let xcIdx = minX; xcIdx <= maxX; xcIdx++) {
            const clusterIndex =
              xcIdx + ycIdx * this.xSlices + zcIdx * this.xSlices * this.ySlices;
            clusterLists[clusterIndex].push(i);
          }
        }
      }
    }

    const clusters = new Uint32Array(this.clusterCount * 2);
    const lightIndices = [];
    let offset = 0;
    for (let i = 0; i < this.clusterCount; i++) {
      const list = clusterLists[i];
      clusters[i * 2] = offset;
      clusters[i * 2 + 1] = list.length;
      for (let j = 0; j < list.length; j++) {
        lightIndices.push(list[j]);
      }
      offset += list.length;
    }

    return { clusters, lightIndices: new Uint32Array(lightIndices) };
  }
}

export default ClusterBuilder;
