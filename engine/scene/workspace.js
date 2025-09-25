import MeshInstance, { TransformNode } from '../render/mesh/meshInstance.js';

const workspace = new TransformNode('Workspace');
workspace.Name = 'Workspace';

workspace.createMeshInstance = function createMeshInstance(
  name,
  mesh,
  material,
  options = {},
) {
  const parent = options.parent === undefined ? workspace : options.parent;
  const className = options.className ?? 'Part';
  const materials = Array.isArray(material)
    ? material
    : material != null
    ? [material]
    : options.materials ?? null;

  const instance = new MeshInstance(mesh ?? null, { className, materials });
  if (typeof name === 'string' && name) {
    instance.Name = name;
  }
  if (parent) {
    instance.Parent = parent;
  }
  return instance;
};

export function getWorkspace() {
  return workspace;
}

export default workspace;
