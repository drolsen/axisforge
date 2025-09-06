export default class EditOps {
  constructor(store) {
    this.store = store;
  }

  apply(op, shape, params = {}) {
    if (shape !== 'sphere') return [];
    const {
      chunkId = '0,0,0',
      x = this.store.chunkSize / 2,
      y = this.store.chunkSize / 2,
      z = this.store.chunkSize / 2,
      radius = this.store.chunkSize / 4,
      strength = 1,
      falloff = 1,
    } = params;
    const chunk = this.store._ensureChunk(chunkId);
    const N = this.store.gridSize;
    const sdf = chunk.sdf;
    for (let zz = 0; zz < N; zz++) {
      for (let yy = 0; yy < N; yy++) {
        for (let xx = 0; xx < N; xx++) {
          const dx = xx - x;
          const dy = yy - y;
          const dz = zz - z;
          const dist = Math.hypot(dx, dy, dz);
          const influence = Math.pow(Math.max(0, 1 - dist / radius), falloff);
          if (influence <= 0) continue;
          const delta = strength * influence;
          const idx = xx + yy * N + zz * N * N;
          if (op === 'add') {
            sdf[idx] = Math.min(sdf[idx], -delta);
          } else if (op === 'subtract') {
            sdf[idx] = Math.max(sdf[idx], delta);
          } else if (op === 'smooth') {
            let sum = 0;
            let count = 0;
            const neighbors = [
              [1, 0, 0],
              [-1, 0, 0],
              [0, 1, 0],
              [0, -1, 0],
              [0, 0, 1],
              [0, 0, -1],
            ];
            for (const [ox, oy, oz] of neighbors) {
              const nx = xx + ox;
              const ny = yy + oy;
              const nz = zz + oz;
              if (nx < 0 || ny < 0 || nz < 0 || nx >= N || ny >= N || nz >= N) continue;
              const nIdx = nx + ny * N + nz * N * N;
              sum += sdf[nIdx];
              count++;
            }
            const avg = count ? sum / count : sdf[idx];
            sdf[idx] = sdf[idx] * (1 - delta) + avg * delta;
          }
        }
      }
    }
    return [chunkId];
  }
}

