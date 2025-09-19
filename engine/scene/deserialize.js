import { Instance, GetService } from '../core/index.js';

// Deserialize a JSON string produced by serialize() back into an Instance
// hierarchy. Service instances are reused if they already exist.
export function deserialize(json, options = {}) {
  const data = typeof json === 'string' ? JSON.parse(json) : json;
  const { getService, services } = options || {};

  const resolveService =
    typeof getService === 'function'
      ? getService
      : services instanceof Map
      ? name => services.get(name)
      : name => GetService(name);

  function build(node) {
    // Reuse existing service instances when available
    let inst = resolveService ? resolveService(node.className) : GetService(node.className);
    if (!inst) {
      inst = new Instance(node.className);
    }
    inst.guid = node.guid;
    inst.Name = node.name;

    for (const [k, v] of Object.entries(node.properties || {})) {
      inst.setProperty(k, v);
    }
    for (const [k, v] of Object.entries(node.attributes || {})) {
      inst.SetAttribute(k, v);
    }

    // Clear existing children before reconstructing
    inst.ClearAllChildren();
    for (const child of node.children || []) {
      const childInst = build(child);
      childInst.Parent = inst;
    }
    return inst;
  }

  return build(data);
}

export default deserialize;
