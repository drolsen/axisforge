import { StandardPBRMaterial } from './material.js';
import {
  allocateStandardPBRUniform,
  updateStandardPBRUniform,
  createStandardPBRLayout,
  STANDARD_PBR_BINDINGS,
} from './ubos.js';
import { ensureDefaultMaterialResources } from './defaults.js';

class MaterialRegistry {
  constructor() {
    this.device = null;
    this.layouts = new Map();
    this.materials = new Map();
    this.nextId = 1;
    this._metadata = new Map();
  }

  init(device) {
    if (this.device && this.device !== device) {
      console.warn('[Materials] Reinitializing registry with a new device. Existing materials will be cleared.');
      this.materials.clear();
      this.nextId = 1;
      this._metadata.clear();
    }
    if (!this.device || this.device !== device) {
      this.device = device;
      if (device) {
        this.layouts.set('StandardPBR', createStandardPBRLayout(device));
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
    if (!layout) {
      throw new Error('StandardPBR material layout not available.');
    }

    const defaults = ensureDefaultMaterialResources(this.device);
    const { albedo, metallicRoughness, normal, occlusion, emissive } = material.maps;

    const entries = [
      { binding: STANDARD_PBR_BINDINGS.UNIFORM, resource: { buffer: uniform.buffer } },
      { binding: STANDARD_PBR_BINDINGS.ALBEDO_TEXTURE, resource: albedo.texture ?? defaults.baseColorView },
      { binding: STANDARD_PBR_BINDINGS.ALBEDO_SAMPLER, resource: albedo.sampler ?? defaults.repeatSampler },
      { binding: STANDARD_PBR_BINDINGS.METALLIC_ROUGHNESS_TEXTURE, resource: metallicRoughness.texture ?? defaults.metallicRoughView },
      { binding: STANDARD_PBR_BINDINGS.METALLIC_ROUGHNESS_SAMPLER, resource: metallicRoughness.sampler ?? defaults.linearSampler },
      { binding: STANDARD_PBR_BINDINGS.NORMAL_TEXTURE, resource: normal.texture ?? defaults.normalView },
      { binding: STANDARD_PBR_BINDINGS.NORMAL_SAMPLER, resource: normal.sampler ?? defaults.linearSampler },
      { binding: STANDARD_PBR_BINDINGS.OCCLUSION_TEXTURE, resource: occlusion.texture ?? defaults.occlusionView },
      { binding: STANDARD_PBR_BINDINGS.OCCLUSION_SAMPLER, resource: occlusion.sampler ?? defaults.linearSampler },
      { binding: STANDARD_PBR_BINDINGS.EMISSIVE_TEXTURE, resource: emissive.texture ?? defaults.emissiveView },
      { binding: STANDARD_PBR_BINDINGS.EMISSIVE_SAMPLER, resource: emissive.sampler ?? defaults.linearSampler },
    ];

    if (entries.some(entry => entry.resource == null)) {
      throw new Error('Missing resources for Standard PBR bind group.');
    }

    const bindGroup = this.device.createBindGroup({
      layout,
      entries,
    });

    return { layout, entries, bindGroup };
  }

  _logRecord(action, record) {
    const { material, binding } = record;
    const bindingStates = binding.entries.map(entry => ({
      binding: entry.binding,
      ready: entry.resource != null,
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

  createPBR(params = {}) {
    this._ensureDevice();
    ensureDefaultMaterialResources(this.device);
    return this.createStandard(params);
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
