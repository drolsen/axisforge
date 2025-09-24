import { Instance, GetService } from '../core/index.js';
import Mesh from '../render/mesh/mesh.js';
import Materials from '../render/materials/registry.js';
import { tryGetDevice } from '../render/gpu/device.js';

const INDEX_ARRAY_TYPES = {
  Uint32Array,
  Uint16Array,
  Uint8Array,
};

function normalizeSceneData(data) {
  if (data && typeof data === 'object' && data.version != null && data.root) {
    return {
      version: data.version,
      root: data.root,
      meshes: Array.isArray(data.meshes) ? data.meshes : [],
      materials: Array.isArray(data.materials) ? data.materials : [],
    };
  }
  return {
    version: 0,
    root: data,
    meshes: [],
    materials: [],
  };
}

function createIndexArray(serialized) {
  if (!serialized || !serialized.data) {
    return null;
  }
  const ctor = INDEX_ARRAY_TYPES[serialized.type] || Uint32Array;
  return new ctor(serialized.data);
}

function restoreMeshAssets(meshDefs, device) {
  const meshes = new Map();
  if (!meshDefs || meshDefs.length === 0) {
    return meshes;
  }

  if (!device) {
    throw new Error('GPU device is required to deserialize mesh assets.');
  }

  for (const meshDef of meshDefs) {
    if (!meshDef) {
      continue;
    }
    const primitives = (meshDef.primitives || []).map(primitive => ({
      vertexData: new Float32Array(primitive.vertexData || []),
      indexData: createIndexArray(primitive.indexData),
      materialId: primitive.materialId ?? null,
    }));
    const mesh = new Mesh(device, primitives);
    if (meshDef.guid) {
      mesh.assetGuid = meshDef.guid;
    }
    const key = mesh.assetGuid || meshDef.guid || `${meshes.size}`;
    meshes.set(key, mesh);
  }

  return meshes;
}

function applyMaterialMetadata(targetId, materialDef) {
  const metadata = {
    name: materialDef?.name,
    textures: materialDef?.textures || {},
  };
  if (typeof Materials.setMetadata === 'function') {
    Materials.setMetadata(targetId, metadata);
  } else if (typeof Materials.setName === 'function') {
    Materials.setName(targetId, metadata.name);
  }
}

function restoreMaterials(materialDefs = [], options = {}) {
  const idMap = new Map();
  const assignments = [];

  for (const materialDef of materialDefs) {
    if (!materialDef || materialDef.id == null) {
      continue;
    }

    const params = materialDef.parameters || {};
    const existing = Materials.get(materialDef.id);
    let targetId = materialDef.id;

    if (existing) {
      Materials.update(targetId, params);
    } else {
      targetId = Materials.createStandard(params);
    }

    applyMaterialMetadata(targetId, materialDef);

    idMap.set(materialDef.id, targetId);
    assignments.push({ targetId, textures: materialDef.textures || {} });
  }

  assignMaterialTextures(assignments, options);
  return idMap;
}

function assignMaterialTextures(assignments, options = {}) {
  if (!assignments.length) {
    return;
  }

  let resolveAsset = null;
  if (typeof options.resolveAsset === 'function') {
    resolveAsset = options.resolveAsset;
  } else if (options.assetService && typeof options.assetService.get === 'function') {
    resolveAsset = guid => options.assetService.get(guid);
  }

  let assignTexture = null;
  if (typeof options.assignTextureFromAsset === 'function') {
    assignTexture = options.assignTextureFromAsset;
  } else if (options.materialRegistry && typeof options.materialRegistry.assignTextureFromAsset === 'function') {
    assignTexture = options.materialRegistry.assignTextureFromAsset.bind(options.materialRegistry);
  }

  if (!resolveAsset || !assignTexture) {
    return;
  }

  for (const entry of assignments) {
    const { targetId, textures } = entry;
    for (const [slotKey, assetInfo] of Object.entries(textures || {})) {
      if (!assetInfo?.guid) {
        continue;
      }
      Promise.resolve(resolveAsset(assetInfo.guid, slotKey, targetId))
        .then(asset => {
          if (!asset) {
            return null;
          }
          Materials.rememberTextureAsset(targetId, slotKey, assetInfo);
          return assignTexture(targetId, slotKey, asset);
        })
        .catch(err => {
          console.warn('[Scene] Failed to restore texture for material', targetId, slotKey, err);
        });
    }
  }
}

// Deserialize a JSON string produced by serialize() back into an Instance
// hierarchy. Service instances are reused if they already exist.
export function deserialize(json, options = {}) {
  const raw = typeof json === 'string' ? JSON.parse(json) : json;
  const data = normalizeSceneData(raw);
  const { getService, services } = options || {};

  const resolveService =
    typeof getService === 'function'
      ? getService
      : services instanceof Map
      ? name => services.get(name)
      : name => GetService(name);

  const device =
    options.device ||
    (typeof options.getDevice === 'function' ? options.getDevice() : null) ||
    tryGetDevice();

  const meshAssets = restoreMeshAssets(data.meshes, device);
  const materialIdMap = restoreMaterials(data.materials, options);

  const remapMaterialId = id => {
    if (id == null) {
      return null;
    }
    return materialIdMap.has(id) ? materialIdMap.get(id) : id;
  };

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

    if (node.meshInstance && typeof inst.setMesh === 'function') {
      const meshGuid = node.meshInstance.mesh;
      const mesh = meshGuid ? meshAssets.get(meshGuid) || null : null;
      if (mesh) {
        inst.setMesh(mesh);
      }

      if (Array.isArray(node.meshInstance.materials) && typeof inst.setMaterial === 'function') {
        node.meshInstance.materials.forEach((materialId, index) => {
          const mapped = remapMaterialId(materialId);
          if (mapped != null) {
            inst.setMaterial(index, mapped);
          }
        });
      }

      const transform = node.meshInstance.transform || {};
      if (transform.position) {
        inst.setProperty('Position', transform.position);
      }
      if (transform.rotation) {
        inst.setProperty('Rotation', transform.rotation);
      }
      if (transform.scale) {
        inst.setProperty('Scale', transform.scale);
      }
    }
    return inst;
  }

  return build(data.root);
}

export default deserialize;
