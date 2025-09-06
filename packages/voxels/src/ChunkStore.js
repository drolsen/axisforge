export default class ChunkStore {
  constructor({ chunkSize = 32 } = {}) {
    this.chunkSize = chunkSize;
    this.gridSize = chunkSize + 1;
    this.chunks = new Map();
    this.worker = null;
  }

  _ensureChunk(chunkId) {
    if (!this.chunks.has(chunkId)) {
      const total = this.gridSize ** 3;
      const sdf = new Float32Array(total).fill(1e6);
      this.chunks.set(chunkId, { sdf, mesh: null });
    }
    return this.chunks.get(chunkId);
  }

  applyEdit({ chunkId, op, shape, params = {} }) {
    const chunk = this._ensureChunk(chunkId);
    const N = this.gridSize;
    const sdf = chunk.sdf;
    const cs = this.chunkSize;
    if (shape === 'cube') {
      const { x = cs / 2, y = cs / 2, z = cs / 2, size = cs } = params;
      for (let zz = 0; zz < N; zz++) {
        for (let yy = 0; yy < N; yy++) {
          for (let xx = 0; xx < N; xx++) {
            const idx = xx + yy * N + zz * N * N;
            const dx = Math.max(Math.abs(xx - x) - size / 2, 0);
            const dy = Math.max(Math.abs(yy - y) - size / 2, 0);
            const dz = Math.max(Math.abs(zz - z) - size / 2, 0);
            const d = Math.hypot(dx, dy, dz);
            if (op === 'add') sdf[idx] = Math.min(sdf[idx], d);
            else sdf[idx] = Math.max(sdf[idx], -d);
          }
        }
      }
    } else if (shape === 'sphere') {
      const { x = cs / 2, y = cs / 2, z = cs / 2, radius = cs / 4 } = params;
      for (let zz = 0; zz < N; zz++) {
        for (let yy = 0; yy < N; yy++) {
          for (let xx = 0; xx < N; xx++) {
            const idx = xx + yy * N + zz * N * N;
            const dx = xx - x;
            const dy = yy - y;
            const dz = zz - z;
            const d = Math.hypot(dx, dy, dz) - radius;
            if (op === 'add') sdf[idx] = Math.min(sdf[idx], d);
            else sdf[idx] = Math.max(sdf[idx], -d);
          }
        }
      }
    }
    chunk.mesh = null;
  }

  async getChunkMesh(chunkId) {
    const chunk = this._ensureChunk(chunkId);
    if (chunk.mesh) return chunk.mesh;
    if (typeof Worker === 'undefined') {
      const { meshFromSDF } = await import('./MesherDualContour.js');
      chunk.mesh = meshFromSDF({ size: this.chunkSize, values: chunk.sdf });
      return chunk.mesh;
    }
    if (!this.worker) {
      this.worker = new Worker(new URL('./worker/mesher.worker.js', import.meta.url), {
        type: 'module',
      });
    }
    return new Promise((resolve) => {
      const handler = (e) => {
        this.worker.removeEventListener('message', handler);
        chunk.mesh = e.data;
        resolve(chunk.mesh);
      };
      this.worker.addEventListener('message', handler);
      this.worker.postMessage({ size: this.chunkSize, sdf: chunk.sdf });
    });
  }
}
