import { TransformNode } from '../render/mesh/meshInstance.js';

const workspace = new TransformNode('Workspace');
workspace.Name = 'Workspace';

export function getWorkspace() {
  return workspace;
}

export default workspace;
