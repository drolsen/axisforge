import loadGLTF from './loader.js';
import { getAccessorArray, isSRGBTextureSlot } from './utils.js';
import Mesh from '../../render/mesh/mesh.js';
import MeshInstance, { TransformNode } from '../../render/mesh/meshInstance.js';
import Materials from '../../render/materials/registry.js';
import { getDevice } from '../../render/gpu/device.js';
import { createTextureFromImage } from '../../render/textures/loader.js';
import { getDefaultAnisotropicSampler, getOrCreateSampler } from '../../render/textures/sampler.js';
import {
  quaternionNormalize,
  decomposeTRS,
  quaternionFromEuler,
} from '../../render/mesh/math.js';
import { VERTEX_FLOATS } from '../../render/mesh/mesh.js';
import { getWorkspace } from '../../scene/workspace.js';

const DEFAULT_NORMAL = [0, 1, 0];
const DEFAULT_TANGENT = [1, 0, 0, 1];
const DEFAULT_UV = [0, 0];

function warnIfUnsupportedTexCoord(info, label) {
  if (info && typeof info.texCoord === 'number' && info.texCoord !== 0) {
    console.warn(`[glTF] ${label} uses TEXCOORD_${info.texCoord}, only TEXCOORD_0 is currently supported.`);
  }
}

function createVertexBufferData(gltf, primitive, buffers) {
  const positionAccessor = primitive.attributes?.POSITION;
  if (typeof positionAccessor !== 'number') {
    throw new Error('Primitive is missing POSITION attribute');
  }
  const positions = getAccessorArray(gltf, positionAccessor, buffers, { forceFloat: true });
  const vertexCount = positions.length / 3;

  const normalsAccessor = primitive.attributes?.NORMAL;
  const normals = typeof normalsAccessor === 'number'
    ? getAccessorArray(gltf, normalsAccessor, buffers, { forceFloat: true })
    : new Float32Array(vertexCount * 3).fill(0);
  if (normalsAccessor == null) {
    for (let i = 0; i < vertexCount; i += 1) {
      normals[i * 3 + 0] = DEFAULT_NORMAL[0];
      normals[i * 3 + 1] = DEFAULT_NORMAL[1];
      normals[i * 3 + 2] = DEFAULT_NORMAL[2];
    }
  }

  const tangentsAccessor = primitive.attributes?.TANGENT;
  const tangents = typeof tangentsAccessor === 'number'
    ? getAccessorArray(gltf, tangentsAccessor, buffers, { forceFloat: true })
    : new Float32Array(vertexCount * 4).fill(0);
  if (tangentsAccessor == null) {
    for (let i = 0; i < vertexCount; i += 1) {
      tangents[i * 4 + 0] = DEFAULT_TANGENT[0];
      tangents[i * 4 + 1] = DEFAULT_TANGENT[1];
      tangents[i * 4 + 2] = DEFAULT_TANGENT[2];
      tangents[i * 4 + 3] = DEFAULT_TANGENT[3];
    }
  }

  const texCoordAccessor = primitive.attributes?.TEXCOORD_0;
  const texCoords = typeof texCoordAccessor === 'number'
    ? getAccessorArray(gltf, texCoordAccessor, buffers, { forceFloat: true })
    : new Float32Array(vertexCount * 2).fill(0);
  if (texCoordAccessor == null) {
    for (let i = 0; i < vertexCount; i += 1) {
      texCoords[i * 2 + 0] = DEFAULT_UV[0];
      texCoords[i * 2 + 1] = DEFAULT_UV[1];
    }
  }

  const vertexData = new Float32Array(vertexCount * VERTEX_FLOATS);
  for (let i = 0; i < vertexCount; i += 1) {
    const offset = i * VERTEX_FLOATS;
    vertexData[offset + 0] = positions[i * 3 + 0];
    vertexData[offset + 1] = positions[i * 3 + 1];
    vertexData[offset + 2] = positions[i * 3 + 2];

    vertexData[offset + 3] = normals[i * 3 + 0];
    vertexData[offset + 4] = normals[i * 3 + 1];
    vertexData[offset + 5] = normals[i * 3 + 2];

    vertexData[offset + 6] = tangents[i * 4 + 0];
    vertexData[offset + 7] = tangents[i * 4 + 1];
    vertexData[offset + 8] = tangents[i * 4 + 2];
    vertexData[offset + 9] = tangents[i * 4 + 3];

    vertexData[offset + 10] = texCoords[i * 2 + 0];
    vertexData[offset + 11] = texCoords[i * 2 + 1];
  }

  return { vertexData, vertexCount };
}

function getIndices(gltf, primitive, buffers) {
  if (typeof primitive.indices !== 'number') {
    const vertexCount = getAccessorArray(gltf, primitive.attributes.POSITION, buffers, { forceFloat: true }).length / 3;
    const indices = vertexCount > 65535 ? new Uint32Array(vertexCount) : new Uint16Array(vertexCount);
    for (let i = 0; i < vertexCount; i += 1) {
      indices[i] = i;
    }
    return indices;
  }
  const data = getAccessorArray(gltf, primitive.indices, buffers);
  if (data instanceof Uint8Array || data instanceof Uint16Array || data instanceof Uint32Array) {
    return data;
  }
  if (data instanceof Float32Array) {
    const result = data.length > 65535 ? new Uint32Array(data.length) : new Uint16Array(data.length);
    for (let i = 0; i < data.length; i += 1) {
      result[i] = data[i];
    }
    return result;
  }
  return new Uint32Array(data);
}

function convertWrap(mode) {
  switch (mode) {
    case 33071: return 'clamp-to-edge';
    case 33648: return 'mirror-repeat';
    case 10497: return 'repeat';
    default: return 'repeat';
  }
}

function convertMagFilter(filter) {
  if (filter === 9728) return 'nearest';
  if (filter === 9729) return 'linear';
  return 'linear';
}

function convertMinFilter(filter) {
  switch (filter) {
    case 9728: return { minFilter: 'nearest', mipmapFilter: 'nearest' };
    case 9729: return { minFilter: 'linear', mipmapFilter: 'nearest' };
    case 9984: return { minFilter: 'nearest', mipmapFilter: 'nearest' };
    case 9985: return { minFilter: 'linear', mipmapFilter: 'nearest' };
    case 9986: return { minFilter: 'nearest', mipmapFilter: 'linear' };
    case 9987: return { minFilter: 'linear', mipmapFilter: 'linear' };
    default: return { minFilter: 'linear', mipmapFilter: 'linear' };
  }
}

function getSampler(device, gltf, samplerCache, samplerIndex) {
  if (typeof samplerIndex !== 'number') {
    if (!samplerCache.has('default')) {
      samplerCache.set('default', getDefaultAnisotropicSampler(device));
    }
    return samplerCache.get('default');
  }
  if (samplerCache.has(samplerIndex)) {
    return samplerCache.get(samplerIndex);
  }
  const samplerDef = gltf.samplers?.[samplerIndex] || {};
  const { minFilter, mipmapFilter } = convertMinFilter(samplerDef.minFilter);
  const descriptor = {
    addressModeU: convertWrap(samplerDef.wrapS),
    addressModeV: convertWrap(samplerDef.wrapT),
    magFilter: convertMagFilter(samplerDef.magFilter),
    minFilter,
    mipmapFilter,
  };
  const sampler = getOrCreateSampler(device, descriptor);
  samplerCache.set(samplerIndex, sampler);
  return sampler;
}

function getTextureResource(device, gltf, textureIndex, images, samplerCache, textureCache, slot) {
  if (typeof textureIndex !== 'number') {
    return { texture: null, sampler: null };
  }
  const key = `${textureIndex}:${slot}`;
  let resource = textureCache.get(key);
  if (!resource) {
    const textureDef = gltf.textures?.[textureIndex];
    if (!textureDef || typeof textureDef.source !== 'number') {
      return { texture: null, sampler: null };
    }
    const image = images[textureDef.source]?.bitmap;
    if (!image) {
      return { texture: null, sampler: null };
    }
    const srgb = isSRGBTextureSlot(slot);
    const created = createTextureFromImage(device, image, {
      label: `glTFTexture:${slot}:${textureIndex}`,
      srgb,
      generateMipmaps: true,
    });
    resource = { texture: created.texture, view: created.view };
    textureCache.set(key, resource);
  }
  const textureDef = gltf.textures?.[textureIndex];
  const sampler = getSampler(device, gltf, samplerCache, textureDef?.sampler);
  return { texture: resource.view, sampler };
}

function createMaterial(device, gltf, materialIndex, images, samplerCache, textureCache) {
  const materialDef = gltf.materials?.[materialIndex];
  if (!materialDef) {
    return Materials.createStandard();
  }
  const params = {
    color: materialDef.pbrMetallicRoughness?.baseColorFactor,
    roughness: materialDef.pbrMetallicRoughness?.roughnessFactor,
    metalness: materialDef.pbrMetallicRoughness?.metallicFactor,
    emissive: materialDef.emissiveFactor,
    occlusionStrength: materialDef.occlusionTexture?.strength,
  };

  const baseColorInfo = materialDef.pbrMetallicRoughness?.baseColorTexture;
  if (baseColorInfo) {
    warnIfUnsupportedTexCoord(baseColorInfo, 'baseColorTexture');
    const resource = getTextureResource(device, gltf, baseColorInfo.index, images, samplerCache, textureCache, 'baseColor');
    params.albedoTexture = resource.texture;
    params.albedoSampler = resource.sampler;
  }

  const metallicRoughnessInfo = materialDef.pbrMetallicRoughness?.metallicRoughnessTexture;
  if (metallicRoughnessInfo) {
    warnIfUnsupportedTexCoord(metallicRoughnessInfo, 'metallicRoughnessTexture');
    const resource = getTextureResource(device, gltf, metallicRoughnessInfo.index, images, samplerCache, textureCache, 'metallicRoughness');
    params.metallicRoughnessTexture = resource.texture;
    params.metallicRoughnessSampler = resource.sampler;
  }

  const normalInfo = materialDef.normalTexture;
  if (normalInfo) {
    warnIfUnsupportedTexCoord(normalInfo, 'normalTexture');
    const resource = getTextureResource(device, gltf, normalInfo.index, images, samplerCache, textureCache, 'normal');
    params.normalTexture = resource.texture;
    params.normalSampler = resource.sampler;
  }

  const occlusionInfo = materialDef.occlusionTexture;
  if (occlusionInfo) {
    warnIfUnsupportedTexCoord(occlusionInfo, 'occlusionTexture');
    const resource = getTextureResource(device, gltf, occlusionInfo.index, images, samplerCache, textureCache, 'occlusion');
    params.occlusionTexture = resource.texture;
    params.occlusionSampler = resource.sampler;
  }

  const emissiveInfo = materialDef.emissiveTexture;
  if (emissiveInfo) {
    warnIfUnsupportedTexCoord(emissiveInfo, 'emissiveTexture');
    const resource = getTextureResource(device, gltf, emissiveInfo.index, images, samplerCache, textureCache, 'emissive');
    params.emissiveTexture = resource.texture;
    params.emissiveSampler = resource.sampler;
  }

  return Materials.createStandard(params);
}

function createMesh(device, gltf, meshDef, buffers, materialCache, materialIdForPrimitive) {
  const primitives = [];
  for (const primitive of meshDef.primitives || []) {
    if (primitive.mode != null && primitive.mode !== 4) {
      console.warn('[glTF] Unsupported primitive mode', primitive.mode, 'defaulting to TRIANGLES');
    }
    const { vertexData } = createVertexBufferData(gltf, primitive, buffers);
    const indices = getIndices(gltf, primitive, buffers);
    const materialIndex = typeof primitive.material === 'number' ? primitive.material : null;
    let materialId = null;
    if (materialIndex != null) {
      if (!materialCache.has(materialIndex)) {
        materialCache.set(materialIndex, materialIdForPrimitive(materialIndex));
      }
      materialId = materialCache.get(materialIndex);
    } else {
      if (!materialCache.has('default')) {
        materialCache.set('default', Materials.createStandard());
      }
      materialId = materialCache.get('default');
    }
    primitives.push({ vertexData, indexData: indices, materialId });
  }
  return new Mesh(device, primitives);
}

function applyNodeTransform(node, nodeDef) {
  let translation = nodeDef.translation ? [...nodeDef.translation] : [0, 0, 0];
  let rotation = nodeDef.rotation ? quaternionNormalize(new Float32Array(nodeDef.rotation)) : quaternionFromEuler({ x: 0, y: 0, z: 0 });
  let scale = nodeDef.scale ? [...nodeDef.scale] : [1, 1, 1];

  if (Array.isArray(nodeDef.matrix)) {
    const matrix = new Float32Array(nodeDef.matrix);
    const { translation: t, rotation: r, scale: s } = decomposeTRS(matrix);
    translation = t;
    rotation = r;
    scale = s;
  }

  node.setProperty('Position', { x: translation[0], y: translation[1], z: translation[2] });
  node.setProperty('Scale', { x: scale[0], y: scale[1], z: scale[2] });
  node.setRotationQuaternion(rotation, true);
}

function buildNodeGraph(device, gltf, nodeIndex, buffers, meshCache, materialCache, images, samplerCache, textureCache, materialIdForPrimitive) {
  const nodeDef = gltf.nodes?.[nodeIndex];
  if (!nodeDef) {
    return null;
  }

  let instance;
  if (typeof nodeDef.mesh === 'number') {
    if (!meshCache.has(nodeDef.mesh)) {
      const meshDef = gltf.meshes?.[nodeDef.mesh];
      if (!meshDef) {
        return null;
      }
      const mesh = createMesh(device, gltf, meshDef, buffers, materialCache, materialIdForPrimitive);
      meshCache.set(nodeDef.mesh, mesh);
    }
    instance = new MeshInstance(meshCache.get(nodeDef.mesh));
  } else {
    instance = new TransformNode('ModelNode');
  }

  instance.Name = nodeDef.name || instance.Name;
  applyNodeTransform(instance, nodeDef);

  for (const childIndex of nodeDef.children || []) {
    const child = buildNodeGraph(device, gltf, childIndex, buffers, meshCache, materialCache, images, samplerCache, textureCache, materialIdForPrimitive);
    if (child) {
      child.Parent = instance;
    }
  }

  return instance;
}

export async function importGLTF(source, options = {}) {
  const device = getDevice();
  const asset = await loadGLTF(source, options);
  const { gltf, buffers, images } = asset;

  const materialCache = new Map();
  const samplerCache = new Map();
  const textureCache = new Map();
  const meshCache = new Map();

  const materialIdForPrimitive = (materialIndex) => createMaterial(device, gltf, materialIndex, images, samplerCache, textureCache);

  const sceneIndex = options.scene ?? gltf.scene ?? 0;
  const sceneDef = gltf.scenes?.[sceneIndex];
  if (!sceneDef) {
    throw new Error(`Scene index ${sceneIndex} not found in glTF`);
  }

  const root = new TransformNode('Model');
  root.Name = options.name || sceneDef.name || 'Model';

  for (const nodeIndex of sceneDef.nodes || []) {
    const node = buildNodeGraph(device, gltf, nodeIndex, buffers, meshCache, materialCache, images, samplerCache, textureCache, materialIdForPrimitive);
    if (node) {
      node.Parent = root;
    }
  }

  const workspace = getWorkspace();
  root.Parent = workspace;

  return {
    root,
    meshes: Array.from(meshCache.values()),
    materials: Array.from(new Set(materialCache.values())),
    asset,
  };
}

export default importGLTF;
