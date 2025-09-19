import { StandardPBRMaterial } from './material.js';
import {
  allocateStandardPBRUniform,
  updateStandardPBRUniform,
  createStandardPBRLayout,
  describeStandardPBRBindings,
  createStandardPBRBindGroup
} from './ubos.js';

class MaterialRegistry {
  constructor() {
    this.device = null;
    this.layouts = new Map();
    this.materials = new Map();
    this.nextId = 1;
  }

  init(device) {
    if (this.device && this.device !== device) {
      console.warn('[Materials] Reinitializing registry with a new device. Existing materials will be cleared.');
      this.materials.clear();
      this.nextId = 1;
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
    const descriptor = describeStandardPBRBindings(material, uniform);
    const bindGroup = createStandardPBRBindGroup(this.device, layout, descriptor);
    return { layout, descriptor, bindGroup };
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
}

const Materials = new MaterialRegistry();

export default Materials;
export { MaterialRegistry };
