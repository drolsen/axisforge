import { makePlane } from '../../engine/primitives/plane.js';
import { makeBox } from '../../engine/primitives/box.js';
import { createMeshFromCPU } from '../../engine/render/mesh/meshFromCPU.js';
import Materials from '../../engine/render/materials/registry.js';
import workspace from '../../engine/scene/workspace.js';
import { getDevice } from '../../engine/render/gpu/device.js';

let baseplateMaterialId = null;
let blockMaterialId = null;

function ensureBaseplateMaterial() {
  if (baseplateMaterialId == null) {
    baseplateMaterialId = Materials.createPBR({
      baseColorFactor: [0.1, 0.35, 0.1, 1.0],
      roughnessFactor: 1.0,
      metallicFactor: 0.0,
    });
  }
  return baseplateMaterialId;
}

function ensureBlockMaterial() {
  if (blockMaterialId == null) {
    blockMaterialId = Materials.createPBR({
      baseColorFactor: [0.7, 0.7, 0.75, 1.0],
      roughnessFactor: 0.6,
      metallicFactor: 0.0,
    });
  }
  return blockMaterialId;
}

export function createBaseplate() {
  const device = getDevice();
  const mesh = createMeshFromCPU(device, makePlane(512, 1));
  const materialId = ensureBaseplateMaterial();
  const instance = workspace.createMeshInstance('Baseplate', mesh, materialId, { className: 'Part' });
  instance.setProperty('Position', { x: 0, y: 0, z: 0 });
  return instance;
}

export function createBlockPart({ name = 'Part', parent = null, size = [4, 1, 4], position = { x: 0, y: 0, z: 0 } } = {}) {
  const device = getDevice();
  const mesh = createMeshFromCPU(device, makeBox(size[0], size[1], size[2]));
  const materialId = ensureBlockMaterial();
  const instance = workspace.createMeshInstance(name, mesh, materialId, { className: 'Part', parent });
  instance.setProperty('Position', position);
  return instance;
}

export default { createBaseplate, createBlockPart };
