import test from 'ava';
import ChunkStore from '../src/ChunkStore.js';

function checksum(mesh) {
  return mesh.positions.reduce((s, v) => s + Math.round(v * 1000), 0);
}

test('save and load deltas reproduces mesh', async t => {
  const storeA = new ChunkStore();
  storeA.applyEdit({
    op: 'add',
    shape: 'sphere',
    params: { chunkId: '0,0,0', x: 10, y: 10, z: 10, radius: 6, strength: 1, falloff: 1 },
  });
  const meshA = await storeA.getChunkMesh('0,0,0');
  const vA = meshA.positions.length / 3;
  const cA = checksum(meshA);

  const json = storeA.saveDeltas();
  const storeB = new ChunkStore();
  storeB.loadDeltas(json);
  const meshB = await storeB.getChunkMesh('0,0,0');
  const vB = meshB.positions.length / 3;
  const cB = checksum(meshB);

  t.is(vA, vB);
  t.is(cA, cB);
});

