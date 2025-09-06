import ChunkStore from '../../packages/voxels/src/ChunkStore.js';

const store = new ChunkStore({ chunkSize: 32 });
const id = '0,0,0';
// create cube then subtract sphere
store.applyEdit({ chunkId: id, op: 'add', shape: 'cube', params: { x: 16, y: 16, z: 16, size: 32 } });
store.applyEdit({ chunkId: id, op: 'sub', shape: 'sphere', params: { x: 16, y: 16, z: 16, radius: 10 } });
const mesh = await store.getChunkMesh(id);

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
ctx.clearRect(0, 0, 64, 64);
ctx.fillStyle = '#000';
ctx.fillRect(0, 0, 64, 64);
ctx.fillStyle = '#0f0';

const { positions, indices } = mesh;
for (let i = 0; i < indices.length; i += 3) {
  const a = indices[i] * 3;
  const b = indices[i + 1] * 3;
  const c = indices[i + 2] * 3;
  const ax = positions[a] * 60 + 2;
  const ay = positions[a + 1] * 60 + 2;
  const bx = positions[b] * 60 + 2;
  const by = positions[b + 1] * 60 + 2;
  const cx = positions[c] * 60 + 2;
  const cy = positions[c + 1] * 60 + 2;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.lineTo(cx, cy);
  ctx.closePath();
  ctx.fill();
}
