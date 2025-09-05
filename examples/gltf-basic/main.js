import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { loadGLTF } from '../../packages/assets/src/importers/gltf2.js';

async function main() {
  const base64 = await fs.readFile('../assets/triangle.glb.base64', 'utf8');
  const tmp = path.join(os.tmpdir(), 'triangle.glb');
  await fs.writeFile(tmp, Buffer.from(base64, 'base64'));
  const modelA = await loadGLTF(tmp);
  const modelB = await loadGLTF('../assets/triangle-textured.gltf');
  console.log('Loaded models', modelA.nodes.length, modelB.nodes.length);
}

main();
