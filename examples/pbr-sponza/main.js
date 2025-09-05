import AssetDB from '../../packages/assets/src/AssetDB.js';

async function run() {
  const gltfModel = await AssetDB.load('./models/Triangle.gltf');
  const glbModel = await AssetDB.load('./models/Triangle.glb.b64');
  console.log('Loaded models:', gltfModel, glbModel);
}

run().catch(err => console.error(err));
