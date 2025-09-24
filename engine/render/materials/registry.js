import { StandardPBRMaterial } from './material.js';
import {
  allocateStandardPBRUniform,
  updateStandardPBRUniform,
  createStandardPBRLayout,
  describeStandardPBRBindings,
  createStandardPBRBindGroup,
  STANDARD_PBR_BINDINGS
} from './ubos.js';
import { getDefaultAnisotropicSampler } from '../textures/sampler.js';

class MaterialRegistry {
  constructor() {
    this.device = null;
    this.layouts = new Map();
    this.materials = new Map();
    this.nextId = 1;
    this.defaults = new Map();
    this._defaultTextures = [];
    this._metadata = new Map();
  }

  init(device) {
    if (this.device && this.device !== device) {
      console.warn('[Materials] Reinitializing registry with a new device. Existing materials will be cleared.');
      this.materials.clear();
      this.nextId = 1;
      this._disposeDefaults();
      this._metadata.clear();
    }
    if (!this.device || this.device !== device) {
      this.device = device;
      if (device) {
        this.layouts.set('StandardPBR', createStandardPBRLayout(device));
        this._createDefaults();
      }
    }
  }

  _ensureDevice() {
    if (!this.device) {
      throw new Error('Materials registry has not been initialized with a GPUDevice. Call Materials.init(device) first.');
    }
  }

  _buildStandardBinding(material, uniform) {
    const layout = this.layouts.get('StandardPBR');
    const descriptor = describeStandardPBRBindings(material, uniform);
    const bindGroup = createStandardPBRBindGroup(this.device, layout, descriptor, this.defaults);
    return { layout, descriptor, bindGroup };
  }

  _disposeDefaults() {
    for (const texture of this._defaultTextures) {
      try {
        texture.destroy();
      } catch {
        // Ignore
      }
    }
    this._defaultTextures = [];
    this.defaults.clear();
  }

  _createSolidTexture(color, format) {
    const data = new Uint8Array(color);
    const texture = this.device.createTexture({
      size: { width: 1, height: 1, depthOrArrayLayers: 1 },
      format,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    this.device.queue.writeTexture(
      { texture },
      data,
      { bytesPerRow: 4 },
      { width: 1, height: 1, depthOrArrayLayers: 1 },
    );
    this._defaultTextures.push(texture);
    return texture.createView();
  }

  _createDefaults() {
    this._disposeDefaults();
    if (!this.device) {
      return;
    }
    const whiteSRGB = this._createSolidTexture([255, 255, 255, 255], 'rgba8unorm-srgb');
    const whiteLinear = this._createSolidTexture([255, 255, 255, 255], 'rgba8unorm');
    const normalDefault = this._createSolidTexture([128, 128, 255, 255], 'rgba8unorm');
    const blackSRGB = this._createSolidTexture([0, 0, 0, 255], 'rgba8unorm-srgb');
    const sampler = getDefaultAnisotropicSampler(this.device);

    const bindings = STANDARD_PBR_BINDINGS;
    this.defaults.set(bindings.ALBEDO_TEXTURE, whiteSRGB);
    this.defaults.set(bindings.METALLIC_ROUGHNESS_TEXTURE, whiteLinear);
    this.defaults.set(bindings.NORMAL_TEXTURE, normalDefault);
    this.defaults.set(bindings.OCCLUSION_TEXTURE, whiteLinear);
    this.defaults.set(bindings.EMISSIVE_TEXTURE, blackSRGB);

    this.defaults.set(bindings.ALBEDO_SAMPLER, sampler);
    this.defaults.set(bindings.METALLIC_ROUGHNESS_SAMPLER, sampler);
    this.defaults.set(bindings.NORMAL_SAMPLER, sampler);
    this.defaults.set(bindings.OCCLUSION_SAMPLER, sampler);
    this.defaults.set(bindings.EMISSIVE_SAMPLER, sampler);
  }

  _logRecord(action, record) {
    const { material, binding } = record;
    const bindingStates = binding.descriptor.entries.map(entry => ({
      binding: entry.binding,
      ready: entry.resource !== null
    }));
    console.info(`[Materials] ${action} ${material.type} #${record.id}`, {
      color: Array.from(material.color),
      roughness: material.roughness,
      metalness: material.metalness,
      emissive: Array.from(material.emissive.slice(0, 3)),
      occlusionStrength: material.occlusionStrength,
      bindings: bindingStates
    });
  }

  createStandard(params = {}) {
    this._ensureDevice();
    const material = new StandardPBRMaterial(params);
    const uniform = allocateStandardPBRUniform(this.device, material);
    const binding = this._buildStandardBinding(material, uniform);
    const id = this.nextId++;
    const record = { id, type: material.type, material, uniform, binding };
    this._metadata.set(id, {
      name: params?.name || `Material ${id}`,
      textures: {},
    });
    this.materials.set(id, record);
    this._logRecord('Created', record);
    return id;
  }

  get(id) {
    return this.materials.get(id) || null;
  }

  update(id, params = {}) {
    const record = this.materials.get(id);
    if (!record) {
      throw new Error(`Material with id ${id} does not exist.`);
    }
    record.material.update(params);
    updateStandardPBRUniform(this.device, record.uniform, record.material);
    record.binding = this._buildStandardBinding(record.material, record.uniform);
    this._logRecord('Updated', record);
  }

  getLayout(type) {
    return this.layouts.get(type) || null;
  }

  _ensureMetadata(id) {
    if (!this._metadata.has(id)) {
      this._metadata.set(id, { name: `Material ${id}`, textures: {} });
    }
    const meta = this._metadata.get(id);
    if (!meta.textures) {
      meta.textures = {};
    }
    return meta;
  }

  setName(id, name) {
    const meta = this._ensureMetadata(id);
    if (name && typeof name === 'string') {
      meta.name = name;
    } else {
      meta.name = `Material ${id}`;
    }
  }

  getMetadata(id) {
    const meta = this._metadata.get(id);
    if (!meta) {
      return { name: `Material ${id}`, textures: {} };
    }
    const textures = {};
    for (const [slot, info] of Object.entries(meta.textures || {})) {
      if (info && typeof info === 'object') {
        textures[slot] = { ...info };
      }
    }
    return {
      name: meta.name || `Material ${id}`,
      textures,
    };
  }

  rememberTextureAsset(id, slotKey, assetInfo) {
    const meta = this._ensureMetadata(id);
    if (!slotKey) {
      return;
    }
    if (assetInfo) {
      meta.textures[slotKey] = {
        guid: assetInfo.guid || null,
        name: assetInfo.name || null,
        logicalPath: assetInfo.logicalPath || null,
      };
    } else {
      delete meta.textures[slotKey];
    }
  }

  setMetadata(id, metadata = {}) {
    const meta = this._ensureMetadata(id);
    meta.name = typeof metadata.name === 'string' && metadata.name.length > 0 ? metadata.name : `Material ${id}`;
    meta.textures = {};
    const textures = metadata.textures || {};
    for (const [slot, info] of Object.entries(textures)) {
      if (info && typeof info === 'object' && info.guid) {
        meta.textures[slot] = {
          guid: info.guid,
          name: info.name || null,
          logicalPath: info.logicalPath || null,
        };
      }
    }
  }
}

const Materials = new MaterialRegistry();

export default Materials;
export { MaterialRegistry };
