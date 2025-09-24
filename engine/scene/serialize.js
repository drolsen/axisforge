import guid from './guid.js';
import { Signal } from '../core/signal.js';
import Materials from '../render/materials/registry.js';

const SCENE_SERIALIZATION_VERSION = 1;

function cloneVector(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }
  return {
    x: Number(value.x) || 0,
    y: Number(value.y) || 0,
    z: Number(value.z) || 0,
  };
}

function cloneBounds(bounds) {
  if (!bounds) {
    return null;
  }
  return {
    min: Array.isArray(bounds.min) ? [...bounds.min] : null,
    max: Array.isArray(bounds.max) ? [...bounds.max] : null,
  };
}

function isMeshInstance(inst) {
  return Boolean(inst && typeof inst === 'object' && typeof inst.getMaterialForPrimitive === 'function' && inst.mesh);
}

function serializeMeshAsset(mesh, meshAssets, collectMaterial) {
  if (!mesh) {
    return null;
  }

  if (!mesh.assetGuid) {
    mesh.assetGuid = guid();
  }

  const assetGuid = mesh.assetGuid;
  if (meshAssets.has(assetGuid)) {
    return assetGuid;
  }

  const cpuPrimitives = typeof mesh.getCPUPrimitives === 'function' ? mesh.getCPUPrimitives() : [];
  const primitives = cpuPrimitives.map(primitive => {
    if (primitive.materialId != null) {
      collectMaterial(primitive.materialId);
    }

    let indexData = null;
    if (primitive.indexData && primitive.indexData.length) {
      indexData = {
        type: primitive.indexData.constructor?.name || null,
        data: Array.from(primitive.indexData),
      };
    }

    return {
      vertexData: primitive.vertexData ? Array.from(primitive.vertexData) : [],
      indexData,
      materialId: primitive.materialId ?? null,
    };
  });

  meshAssets.set(assetGuid, {
    guid: assetGuid,
    primitives,
    bounds: cloneBounds(mesh.bounds),
  });

  return assetGuid;
}

function collectMaterialRecord(materialId, materialMap) {
  if (materialId == null || materialMap.has(materialId)) {
    return;
  }

  const record = Materials.get(materialId);
  if (!record) {
    return;
  }

  const { material, type } = record;
  const metadata = typeof Materials.getMetadata === 'function' ? Materials.getMetadata(materialId) : { name: `Material ${materialId}`, textures: {} };

  materialMap.set(materialId, {
    id: materialId,
    type,
    name: metadata.name || `Material ${materialId}`,
    parameters: {
      color: Array.from(material.color || []),
      roughness: material.roughness,
      metalness: material.metalness,
      emissive: Array.from((material.emissive && material.emissive.subarray ? material.emissive.subarray(0, 3) : [0, 0, 0])),
      occlusionStrength: material.occlusionStrength,
    },
    textures: { ...(metadata.textures || {}) },
  });
}

// Serialize an Instance hierarchy to JSON.
// Only serializes own enumerable properties (excluding engine internals),
// attributes and child relationships. Each node receives a stable GUID.
export function serialize(root) {
  const meshAssets = new Map();
  const materialMap = new Map();

  const collectMaterial = id => collectMaterialRecord(id, materialMap);

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

    if (isMeshInstance(inst)) {
      const meshGuid = serializeMeshAsset(inst.mesh, meshAssets, collectMaterial);
      const materials = [];
      if (inst.mesh && Array.isArray(inst.mesh.primitives)) {
        for (let i = 0; i < inst.mesh.primitives.length; i += 1) {
          const materialId = inst.getMaterialForPrimitive(i);
          if (materialId != null) {
            collectMaterial(materialId);
            materials.push(materialId);
          } else {
            materials.push(null);
          }
        }
      }

      const transform = {
        position: cloneVector(node.properties?.Position),
        rotation: cloneVector(node.properties?.Rotation),
        scale: cloneVector(node.properties?.Scale),
      };

      node.meshInstance = {
        mesh: meshGuid,
        materials,
        transform,
      };
    }

    node.children = inst.Children.map(serializeInst);
    return node;
  }

  const scene = {
    version: SCENE_SERIALIZATION_VERSION,
    root: serializeInst(root),
    meshes: Array.from(meshAssets.values()),
    materials: Array.from(materialMap.values()),
  };

  return JSON.stringify(scene);
}

export default serialize;
