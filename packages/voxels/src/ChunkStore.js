import EditOps from './EditOps.js';

export default class ChunkStore {
  constructor({ chunkSize = 32 } = {}) {
    this.chunkSize = chunkSize;
    this.gridSize = chunkSize + 1;
    this.chunks = new Map();
    this.worker = null;
    this.deltas = [];
    this.editOps = new EditOps(this);
  }

  _ensureChunk(chunkId) {
    if (!this.chunks.has(chunkId)) {
      const total = this.gridSize ** 3;
      const sdf = new Float32Array(total).fill(1e6);
      this.chunks.set(chunkId, { sdf, mesh: null });
    }
    return this.chunks.get(chunkId);
  }

  applyEdit({ op, shape, params = {} }) {
    const affected = this.editOps.apply(op, shape, params);
    this.deltas.push({ op, shape, params });
    for (const id of affected) {
      const chunk = this._ensureChunk(id);
      chunk.mesh = null;
    }
    return affected;
  }

  saveDeltas() {
    return JSON.stringify(this.deltas);
  }

  loadDeltas(json) {
    const ops = typeof json === 'string' ? JSON.parse(json) : json;
    this.deltas = Array.isArray(ops) ? ops : [];
    for (const { op, shape, params } of this.deltas) {
      this.editOps.apply(op, shape, params);
    }
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
