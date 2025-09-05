import test from 'ava';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadGLTF } from '../src/importers/gltf2.js';

function assetPath(p) {
  return fileURLToPath(new URL(`../../../examples/assets/${p}`, import.meta.url));
}

test('load GLB model', async (t) => {
  const base64 = await fs.readFile(assetPath('triangle.glb.base64'), 'utf8');
  const tmp = path.join(os.tmpdir(), 'triangle.glb');
  await fs.writeFile(tmp, Buffer.from(base64, 'base64'));
  const model = await loadGLTF(tmp);
  t.is(model.nodes.length, 1);
  const mat = model.nodes[0].mesh.primitives[0].material;
  t.deepEqual(mat.pbrMetallicRoughness.baseColorFactor, [1, 0, 0, 1]);
});

test('load GLTF with texture', async (t) => {
  const model = await loadGLTF(assetPath('triangle-textured.gltf'));
  const mat = model.nodes[0].mesh.primitives[0].material;
  t.truthy(mat.pbrMetallicRoughness.baseColorTexture.image.buffer);
});
