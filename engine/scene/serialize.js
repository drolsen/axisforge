import guid from './guid.js';
import { Signal } from '../core/signal.js';

// Serialize an Instance hierarchy to JSON.
// Only serializes own enumerable properties (excluding engine internals),
// attributes and child relationships. Each node receives a stable GUID.
export function serialize(root) {
  function serializeInst(inst) {
    if (!inst.guid) inst.guid = guid();

    const node = {
      guid: inst.guid,
      className: inst.ClassName,
      name: inst.Name,
      properties: {},
      attributes: inst.GetAttributes(),
      children: [],
    };

    for (const [k, v] of Object.entries(inst)) {
      if (!Object.prototype.hasOwnProperty.call(inst, k)) continue;
      if (
        k === 'ClassName' ||
        k === 'Name' ||
        k === 'Children' ||
        k === 'Attributes' ||
        k === '_parent' ||
        k === 'guid'
      )
        continue;
      if (v instanceof Signal) continue;
      if (typeof v === 'function') continue;
      node.properties[k] = v;
    }

    node.children = inst.Children.map(serializeInst);
    return node;
  }

  const data = serializeInst(root);
  return JSON.stringify(data);
}

export default serialize;
