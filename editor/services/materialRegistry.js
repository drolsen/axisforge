import Materials from '../../engine/render/materials/registry.js';
import { Signal } from '../../engine/core/signal.js';
import { tryGetDevice } from '../../engine/render/gpu/device.js';
import { createTextureFromImage } from '../../engine/render/textures/loader.js';
import { getDefaultAnisotropicSampler, getDefaultLinearSampler } from '../../engine/render/textures/sampler.js';

const MATERIAL_TEXTURE_SLOTS = [
  { key: 'albedo', label: 'Base Color', paramTexture: 'albedoTexture', paramSampler: 'albedoSampler', srgb: true },
  { key: 'normal', label: 'Normal', paramTexture: 'normalTexture', paramSampler: 'normalSampler', srgb: false },
  {
    key: 'metallicRoughness',
    label: 'Metallic & Roughness',
    paramTexture: 'metallicRoughnessTexture',
    paramSampler: 'metallicRoughnessSampler',
    srgb: false,
  },
  { key: 'occlusion', label: 'Ambient Occlusion', paramTexture: 'occlusionTexture', paramSampler: 'occlusionSampler', srgb: false },
  { key: 'emissive', label: 'Emissive', paramTexture: 'emissiveTexture', paramSampler: 'emissiveSampler', srgb: true },
];

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

function extension(name = '') {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : '';
}

function guessMimeType(name) {
  switch (extension(name)) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'ktx':
    case 'ktx2':
      return 'image/ktx2';
    case 'tga':
      return 'image/x-tga';
    default:
      return 'image/png';
  }
}

function decodeBase64ToBytes(base64) {
  if (!base64) {
    return new Uint8Array();
  }

  if (typeof Buffer !== 'undefined') {
    return Uint8Array.from(Buffer.from(base64, 'base64'));
  }

  if (typeof atob === 'function') {
    const sanitized = String(base64).replace(/[^0-9a-zA-Z+/=]/g, '');
    const length = Math.floor((sanitized.length * 3) / 4);
    const bytes = new Uint8Array(length);
    let byteIndex = 0;
    for (let i = 0; i < sanitized.length; i += 4) {
      const enc1 = BASE64_CHARS.indexOf(sanitized[i]);
      const enc2 = BASE64_CHARS.indexOf(sanitized[i + 1]);
      const enc3 = BASE64_CHARS.indexOf(sanitized[i + 2]);
      const enc4 = BASE64_CHARS.indexOf(sanitized[i + 3]);

      const chr1 = (enc1 << 2) | (enc2 >> 4);
      const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      const chr3 = ((enc3 & 3) << 6) | enc4;

      bytes[byteIndex++] = chr1;
      if (enc3 !== 64 && byteIndex < length) bytes[byteIndex++] = chr2;
      if (enc4 !== 64 && byteIndex < length) bytes[byteIndex++] = chr3;
    }
    return bytes;
  }

  throw new Error('Base64 decoding is not supported in this environment');
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

class EditorMaterialRegistry {
  constructor() {
    this.instanceMaterials = new WeakMap();
    this.InstanceMaterialsChanged = new Signal();
    this.MaterialChanged = new Signal();
    this._textureRefs = new Map();
    this._assetRefs = new Map();
    this._samplers = new Map();
    this._guidIndex = new Map();
  }

  _getTextureStore(materialId) {
    if (!this._textureRefs.has(materialId)) {
      this._textureRefs.set(materialId, new Map());
    }
    return this._textureRefs.get(materialId);
  }

  _getAssetStore(materialId) {
    if (!this._assetRefs.has(materialId)) {
      this._assetRefs.set(materialId, new Map());
    }
    return this._assetRefs.get(materialId);
  }

  _getSampler(slotKey) {
    if (!this._samplers.has(slotKey)) {
      const device = tryGetDevice();
      if (!device) {
        throw new Error('GPU device is not initialized');
      }
      const sampler = slotKey === 'metallicRoughness' || slotKey === 'occlusion'
        ? getDefaultLinearSampler(device)
        : getDefaultAnisotropicSampler(device);
      this._samplers.set(slotKey, sampler);
    }
    return this._samplers.get(slotKey);
  }

  _rememberAssignment(materialId, slotKey, assetInfo = null) {
    const store = this._getAssetStore(materialId);
    if (assetInfo) {
      const entry = { ...assetInfo };
      store.set(slotKey, entry);
      if (entry.guid) {
        if (!this._guidIndex.has(entry.guid)) {
          this._guidIndex.set(entry.guid, new Set());
        }
        this._guidIndex.get(entry.guid).add(`${materialId}:${slotKey}`);
      }
    } else {
      store.delete(slotKey);
      for (const [guid, refs] of this._guidIndex.entries()) {
        refs.delete(`${materialId}:${slotKey}`);
        if (!refs.size) {
          this._guidIndex.delete(guid);
        }
      }
    }
  }

  getAssignedAsset(materialId, slotKey) {
    const store = this._assetRefs.get(materialId);
    if (!store) {
      return null;
    }
    const asset = store.get(slotKey);
    return asset ? { ...asset } : null;
  }

  trackInstance(instance) {
    if (!instance || typeof instance.getMaterialForPrimitive !== 'function' || !instance.mesh) {
      this.instanceMaterials.delete(instance);
      return [];
    }
    const map = new Map();
    for (let i = 0; i < instance.mesh.primitives.length; i += 1) {
      const materialId = instance.getMaterialForPrimitive(i);
      if (materialId != null) {
        map.set(i, materialId);
      }
    }
    this.instanceMaterials.set(instance, map);
    return this.getInstanceMaterials(instance);
  }

  getInstanceMaterials(instance) {
    if (!instance || typeof instance.getMaterialForPrimitive !== 'function' || !instance.mesh) {
      return [];
    }
    let map = this.instanceMaterials.get(instance);
    if (!map) {
      map = new Map();
      this.instanceMaterials.set(instance, map);
    }
    const result = [];
    const seen = new Set();
    for (let i = 0; i < instance.mesh.primitives.length; i += 1) {
      const materialId = instance.getMaterialForPrimitive(i);
      if (materialId != null) {
        map.set(i, materialId);
        const record = Materials.get(materialId) || null;
        result.push({ primitive: i, materialId, record });
        seen.add(i);
      }
    }
    for (const key of Array.from(map.keys())) {
      if (!seen.has(key)) {
        map.delete(key);
      }
    }
    return result;
  }

  setInstanceMaterial(instance, primitiveIndex, materialId) {
    if (!instance || typeof instance.setMaterial !== 'function') {
      return;
    }
    instance.setMaterial(primitiveIndex, materialId);
    let map = this.instanceMaterials.get(instance);
    if (!map) {
      map = new Map();
      this.instanceMaterials.set(instance, map);
    }
    map.set(primitiveIndex, materialId);
    this.InstanceMaterialsChanged.Fire({ instance, primitive: primitiveIndex, materialId });
  }

  getMaterialInfo(materialId) {
    const record = Materials.get(materialId);
    if (!record) {
      return null;
    }
    const { material, type } = record;
    return {
      id: materialId,
      type,
      color: Array.from(material.color),
      roughness: material.roughness,
      metalness: material.metalness,
      emissive: Array.from(material.emissive.slice(0, 3)),
      occlusionStrength: material.occlusionStrength,
      maps: {
        albedo: { ...material.maps.albedo },
        metallicRoughness: { ...material.maps.metallicRoughness },
        normal: { ...material.maps.normal },
        occlusion: { ...material.maps.occlusion },
        emissive: { ...material.maps.emissive },
      },
    };
  }

  updateMaterial(materialId, params = {}) {
    Materials.update(materialId, params);
    this.MaterialChanged.Fire({ materialId, params });
  }

  async assignTextureFromAsset(materialId, slotKey, asset) {
    if (!asset) {
      throw new Error('No asset provided for texture assignment');
    }
    const slot = MATERIAL_TEXTURE_SLOTS.find(entry => entry.key === slotKey);
    if (!slot) {
      throw new Error(`Unknown texture slot: ${slotKey}`);
    }

    const device = tryGetDevice();
    if (!device) {
      throw new Error('GPU device is not initialized');
    }
    if (typeof createImageBitmap !== 'function') {
      throw new Error('createImageBitmap is not supported in this environment');
    }

    let bitmap = null;
    if (asset.data) {
      const bytes = decodeBase64ToBytes(asset.data);
      const blob = new Blob([bytes], { type: guessMimeType(asset.name) });
      bitmap = await createImageBitmap(blob);
    } else if (asset.source?.kind === 'path' && asset.source.value) {
      const response = await fetch(asset.source.value);
      const blob = await response.blob();
      bitmap = await createImageBitmap(blob);
    } else if (asset.blob instanceof Blob) {
      bitmap = await createImageBitmap(asset.blob);
    } else {
      throw new Error('Asset does not contain image data');
    }

    const { texture, view } = createTextureFromImage(device, bitmap, {
      label: `EditorTexture:${slot.key}:${asset.name || 'asset'}`,
      srgb: Boolean(slot.srgb),
      generateMipmaps: true,
    });

    if (typeof bitmap.close === 'function') {
      bitmap.close();
    }

    const params = {
      [slot.paramTexture]: view,
      [slot.paramSampler]: this._getSampler(slot.key),
    };

    const store = this._getTextureStore(materialId);
    const existing = store.get(slot.key);
    if (existing?.texture && existing.texture !== texture) {
      try {
        existing.texture.destroy();
      } catch (err) {
        console.warn('[Materials] Failed to destroy previous texture', err);
      }
    }
    store.set(slot.key, { texture, view });

    this._rememberAssignment(materialId, slot.key, {
      guid: asset.guid,
      name: asset.name,
      logicalPath: asset.logicalPath,
    });

    Materials.rememberTextureAsset(materialId, slot.key, {
      guid: asset.guid,
      name: asset.name,
      logicalPath: asset.logicalPath,
    });

    this.updateMaterial(materialId, params);
  }

  clearTexture(materialId, slotKey) {
    const slot = MATERIAL_TEXTURE_SLOTS.find(entry => entry.key === slotKey);
    if (!slot) {
      return;
    }
    const store = this._textureRefs.get(materialId);
    if (store) {
      const existing = store.get(slot.key);
      if (existing?.texture) {
        try {
          existing.texture.destroy();
        } catch (err) {
          console.warn('[Materials] Failed to destroy texture', err);
        }
      }
      store.delete(slot.key);
    }
    this._rememberAssignment(materialId, slot.key, null);
    Materials.rememberTextureAsset(materialId, slot.key, null);
    this.updateMaterial(materialId, {
      [slot.paramTexture]: null,
      [slot.paramSampler]: null,
    });
  }

  async refreshAssignmentsForAsset(asset, resolver = null) {
    const guid = asset?.guid;
    if (!guid) {
      return;
    }
    const references = this._guidIndex.get(guid);
    if (!references || !references.size) {
      return;
    }
    let assetData = asset;
    if (!assetData?.data && typeof resolver === 'function') {
      try {
        assetData = await resolver(guid);
      } catch (err) {
        console.warn('[Materials] Failed to resolve asset for refresh', err);
        return;
      }
    }
    if (!assetData) {
      return;
    }
    for (const ref of Array.from(references)) {
      const [materialIdStr, slotKey] = ref.split(':');
      const materialId = Number(materialIdStr);
      if (!Number.isFinite(materialId) || !slotKey) {
        continue;
      }
      try {
        await this.assignTextureFromAsset(materialId, slotKey, assetData);
      } catch (err) {
        console.warn('[Materials] Failed to refresh texture assignment', { materialId, slotKey }, err);
      }
    }
  }

  setBaseColor(materialId, color) {
    const info = this.getMaterialInfo(materialId);
    const alpha = info?.color?.[3] ?? 1;
    const clamped = [
      clamp01(color[0]),
      clamp01(color[1]),
      clamp01(color[2]),
      clamp01(alpha),
    ];
    this.updateMaterial(materialId, { color: clamped });
  }

  setMetalness(materialId, value) {
    this.updateMaterial(materialId, { metalness: clamp01(value) });
  }

  setRoughness(materialId, value) {
    this.updateMaterial(materialId, { roughness: clamp01(value) });
  }

  setEmissive(materialId, rgb, intensity = 1) {
    const emissive = rgb.map(component => Math.max(0, component * intensity));
    this.updateMaterial(materialId, { emissive });
  }

  setEmissiveDirect(materialId, rgb) {
    const clamped = [
      clamp01(rgb[0]),
      clamp01(rgb[1]),
      clamp01(rgb[2]),
    ];
    this.updateMaterial(materialId, { emissive: clamped });
  }
}

const registry = new EditorMaterialRegistry();

export default registry;
export { EditorMaterialRegistry, MATERIAL_TEXTURE_SLOTS };
