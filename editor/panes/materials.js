import AssetService from '../services/assets.js';
import MaterialRegistry, { MATERIAL_TEXTURE_SLOTS } from '../services/materialRegistry.js';
import { Selection } from '../services/selection.js';

function createLabel(text) {
  const label = document.createElement('div');
  label.textContent = text;
  label.style.fontSize = '12px';
  label.style.fontWeight = '600';
  label.style.color = '#cdd3dc';
  label.style.marginBottom = '4px';
  return label;
}

function createRow() {
  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.alignItems = 'center';
  row.style.justifyContent = 'space-between';
  row.style.marginBottom = '10px';
  return row;
}

function toHexComponent(value) {
  const clamped = Math.min(255, Math.max(0, Math.round(value * 255)));
  return clamped.toString(16).padStart(2, '0');
}

function rgbToHex(rgb = [0, 0, 0]) {
  return `#${toHexComponent(rgb[0])}${toHexComponent(rgb[1])}${toHexComponent(rgb[2])}`;
}

function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) {
    return [0, 0, 0];
  }
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  return [r, g, b];
}

function formatValue(value, digits = 2) {
  return (Math.round(value * 10 ** digits) / 10 ** digits).toFixed(digits);
}

function decomposeEmissive(emissive = [0, 0, 0]) {
  const intensity = Math.max(0, Math.max(emissive[0], emissive[1], emissive[2]));
  if (intensity <= 0.0001) {
    return { color: '#000000', intensity: 0 };
  }
  const color = emissive.map(component => (component / intensity) || 0);
  return { color: rgbToHex(color), intensity };
}

function createSlider(label, { min = 0, max = 1, step = 0.01 } = {}) {
  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.marginBottom = '12px';

  const labelRow = document.createElement('div');
  labelRow.style.display = 'flex';
  labelRow.style.justifyContent = 'space-between';
  labelRow.style.alignItems = 'center';
  labelRow.style.marginBottom = '4px';

  const labelEl = document.createElement('span');
  labelEl.textContent = label;
  labelEl.style.fontSize = '12px';
  labelEl.style.fontWeight = '600';
  labelEl.style.color = '#cdd3dc';

  const valueEl = document.createElement('span');
  valueEl.style.fontSize = '11px';
  valueEl.style.color = '#8891a5';

  labelRow.appendChild(labelEl);
  labelRow.appendChild(valueEl);

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = String(min);
  slider.max = String(max);
  slider.step = String(step);
  slider.style.width = '100%';

  container.appendChild(labelRow);
  container.appendChild(slider);

  return { container, label: labelEl, value: valueEl, input: slider };
}

function createButton(label, variant = 'primary') {
  const button = document.createElement('button');
  button.textContent = label;
  button.style.border = 'none';
  button.style.borderRadius = '6px';
  button.style.padding = '6px 10px';
  button.style.fontSize = '12px';
  button.style.fontWeight = '600';
  button.style.cursor = 'pointer';
  button.style.transition = 'opacity 120ms ease, transform 120ms ease';
  button.style.color = variant === 'danger' ? '#ffb6b6' : '#e3e8f4';
  button.style.background = variant === 'danger' ? 'rgba(231, 76, 60, 0.15)' : 'rgba(255, 255, 255, 0.06)';
  button.addEventListener('mousedown', () => {
    button.style.transform = 'scale(0.97)';
  });
  button.addEventListener('mouseup', () => {
    button.style.transform = 'scale(1)';
  });
  button.addEventListener('mouseleave', () => {
    button.style.transform = 'scale(1)';
  });
  return button;
}

const DEFAULT_MESSAGE = 'Select a mesh to edit its materials';

export default class MaterialsPane {
  constructor({ selection = new Selection(), registry = MaterialRegistry, assets = new AssetService() } = {}) {
    this.selection = selection;
    this.registry = registry;
    this.assets = assets;

    this.currentInstance = null;
    this.currentMaterialId = null;
    this.currentPrimitive = 0;
    this.materials = [];
    this.assetPicker = null;
    this.assetPickerSlot = null;

    this.root = null;
    this.instanceLabel = null;
    this.materialSelect = null;
    this.baseColorInput = null;
    this.metallicControl = null;
    this.roughnessControl = null;
    this.emissiveColorInput = null;
    this.emissiveIntensity = null;
    this.textureSlots = new Map();
    this.statusMessage = null;

    if (typeof document !== 'undefined') {
      this._buildUI();
      this._attachListeners();
      this._refreshSelection();
    }
  }

  dispose() {
    if (this.selectionConnection) {
      this.selectionConnection.Disconnect();
      this.selectionConnection = null;
    }
    if (this.materialConnection) {
      this.materialConnection.Disconnect();
      this.materialConnection = null;
    }
    if (this.root && this.root.parentElement) {
      this.root.parentElement.removeChild(this.root);
    }
  }

  _attachListeners() {
    this.selectionConnection = this.selection.Changed.Connect(() => {
      this._refreshSelection();
    });
    this.materialConnection = this.registry.MaterialChanged.Connect(({ materialId }) => {
      if (this.currentMaterialId === materialId) {
        this._applyMaterialInfo();
      }
    });
  }

  _buildUI() {
    this.root = document.createElement('div');
    this.root.id = 'materials-pane';
    this.root.style.position = 'fixed';
    this.root.style.top = '120px';
    this.root.style.right = '24px';
    this.root.style.width = '320px';
    this.root.style.maxHeight = 'calc(100vh - 160px)';
    this.root.style.overflow = 'auto';
    this.root.style.padding = '18px 18px 24px';
    this.root.style.borderRadius = '16px';
    this.root.style.background = 'rgba(17, 20, 29, 0.92)';
    this.root.style.backdropFilter = 'blur(12px)';
    this.root.style.boxShadow = '0 16px 40px rgba(0, 0, 0, 0.45)';
    this.root.style.zIndex = '1001';
    this.root.style.color = '#fff';
    this.root.style.fontFamily = 'Inter, system-ui, sans-serif';

    const title = document.createElement('div');
    title.textContent = 'Materials';
    title.style.fontSize = '16px';
    title.style.fontWeight = '700';
    title.style.marginBottom = '12px';
    this.root.appendChild(title);

    this.instanceLabel = document.createElement('div');
    this.instanceLabel.style.fontSize = '13px';
    this.instanceLabel.style.color = '#9aa3b9';
    this.instanceLabel.style.marginBottom = '12px';
    this.root.appendChild(this.instanceLabel);

    const materialRow = createRow();
    const materialLabel = document.createElement('span');
    materialLabel.textContent = 'Primitive';
    materialLabel.style.fontSize = '12px';
    materialLabel.style.fontWeight = '600';
    materialLabel.style.color = '#cdd3dc';

    this.materialSelect = document.createElement('select');
    this.materialSelect.style.flex = '1';
    this.materialSelect.style.marginLeft = '12px';
    this.materialSelect.style.background = 'rgba(255, 255, 255, 0.05)';
    this.materialSelect.style.border = 'none';
    this.materialSelect.style.color = '#e3e8f4';
    this.materialSelect.style.padding = '6px 8px';
    this.materialSelect.style.borderRadius = '6px';
    this.materialSelect.style.fontSize = '12px';

    this.materialSelect.addEventListener('change', () => {
      const index = Number(this.materialSelect.value);
      if (!Number.isNaN(index)) {
        this.currentPrimitive = index;
        this._selectPrimitive(index);
      }
    });

    materialRow.appendChild(materialLabel);
    materialRow.appendChild(this.materialSelect);
    this.root.appendChild(materialRow);

    const baseColorLabel = createLabel('Base Color');
    this.root.appendChild(baseColorLabel);

    this.baseColorInput = document.createElement('input');
    this.baseColorInput.type = 'color';
    this.baseColorInput.value = '#ffffff';
    this.baseColorInput.style.width = '100%';
    this.baseColorInput.style.height = '34px';
    this.baseColorInput.style.border = 'none';
    this.baseColorInput.style.borderRadius = '8px';
    this.baseColorInput.style.background = 'rgba(255, 255, 255, 0.05)';
    this.baseColorInput.style.cursor = 'pointer';
    this.baseColorInput.addEventListener('input', () => {
      if (!this.currentMaterialId) return;
      const rgb = hexToRgb(this.baseColorInput.value);
      this.registry.setBaseColor(this.currentMaterialId, rgb);
    });
    this.root.appendChild(this.baseColorInput);

    this.metallicControl = createSlider('Metallic', { min: 0, max: 1, step: 0.01 });
    this.metallicControl.input.addEventListener('input', () => {
      if (!this.currentMaterialId) return;
      const value = Number(this.metallicControl.input.value);
      this.metallicControl.value.textContent = formatValue(value);
      this.registry.setMetalness(this.currentMaterialId, value);
    });
    this.root.appendChild(this.metallicControl.container);

    this.roughnessControl = createSlider('Roughness', { min: 0, max: 1, step: 0.01 });
    this.roughnessControl.input.addEventListener('input', () => {
      if (!this.currentMaterialId) return;
      const value = Number(this.roughnessControl.input.value);
      this.roughnessControl.value.textContent = formatValue(value);
      this.registry.setRoughness(this.currentMaterialId, value);
    });
    this.root.appendChild(this.roughnessControl.container);

    const emissiveLabel = createLabel('Emissive Color');
    emissiveLabel.style.marginTop = '12px';
    this.root.appendChild(emissiveLabel);

    this.emissiveColorInput = document.createElement('input');
    this.emissiveColorInput.type = 'color';
    this.emissiveColorInput.value = '#000000';
    this.emissiveColorInput.style.width = '100%';
    this.emissiveColorInput.style.height = '34px';
    this.emissiveColorInput.style.border = 'none';
    this.emissiveColorInput.style.borderRadius = '8px';
    this.emissiveColorInput.style.background = 'rgba(255, 255, 255, 0.05)';
    this.emissiveColorInput.style.cursor = 'pointer';

    this.emissiveColorInput.addEventListener('input', () => {
      this._applyEmissiveInputs();
    });
    this.root.appendChild(this.emissiveColorInput);

    this.emissiveIntensity = createSlider('Emissive Intensity', { min: 0, max: 10, step: 0.1 });
    this.emissiveIntensity.input.addEventListener('input', () => {
      this._applyEmissiveInputs();
    });
    this.root.appendChild(this.emissiveIntensity.container);

    const texturesTitle = document.createElement('div');
    texturesTitle.textContent = 'Textures';
    texturesTitle.style.fontSize = '13px';
    texturesTitle.style.fontWeight = '700';
    texturesTitle.style.margin = '16px 0 8px';
    texturesTitle.style.color = '#cdd3dc';
    this.root.appendChild(texturesTitle);

    for (const slot of MATERIAL_TEXTURE_SLOTS) {
      const slotRow = document.createElement('div');
      slotRow.style.display = 'flex';
      slotRow.style.alignItems = 'center';
      slotRow.style.gap = '8px';
      slotRow.style.marginBottom = '10px';

      const slotInfo = document.createElement('div');
      slotInfo.style.flex = '1';
      slotInfo.style.display = 'flex';
      slotInfo.style.flexDirection = 'column';

      const slotLabel = document.createElement('span');
      slotLabel.textContent = slot.label;
      slotLabel.style.fontSize = '12px';
      slotLabel.style.fontWeight = '600';
      slotLabel.style.color = '#cdd3dc';

      const slotValue = document.createElement('span');
      slotValue.textContent = 'Default';
      slotValue.style.fontSize = '11px';
      slotValue.style.color = '#8891a5';
      slotValue.style.marginTop = '2px';

      slotInfo.appendChild(slotLabel);
      slotInfo.appendChild(slotValue);

      const browseButton = createButton('Browse');
      browseButton.addEventListener('click', () => {
        this._openAssetPicker(slot);
      });

      const clearButton = createButton('Clear', 'danger');
      clearButton.addEventListener('click', () => {
        if (!this.currentMaterialId) return;
        this.registry.clearTexture(this.currentMaterialId, slot.key);
      });

      slotRow.appendChild(slotInfo);
      slotRow.appendChild(browseButton);
      slotRow.appendChild(clearButton);

      this.root.appendChild(slotRow);

      this.textureSlots.set(slot.key, {
        label: slotLabel,
        value: slotValue,
        browse: browseButton,
        clear: clearButton,
      });
    }

    this.statusMessage = document.createElement('div');
    this.statusMessage.textContent = DEFAULT_MESSAGE;
    this.statusMessage.style.fontSize = '12px';
    this.statusMessage.style.color = '#6f7891';
    this.statusMessage.style.marginTop = '16px';
    this.root.appendChild(this.statusMessage);

    document.body.appendChild(this.root);
  }

  _applyEmissiveInputs() {
    if (!this.currentMaterialId) return;
    const rgb = hexToRgb(this.emissiveColorInput.value);
    const intensity = Number(this.emissiveIntensity.input.value);
    this.emissiveIntensity.value.textContent = formatValue(intensity, 2);
    this.registry.setEmissive(this.currentMaterialId, rgb, intensity);
  }

  _setStatus(message) {
    if (!this.statusMessage) return;
    this.statusMessage.textContent = message;
  }

  async _openAssetPicker(slot) {
    if (!this.currentMaterialId) return;
    await this.assets.ready;
    const assets = await this.assets.list();
    const textures = assets.filter(asset => asset.type === 'textures');

    if (!textures.length) {
      alert('No texture assets available. Import textures via the Asset Manager first.');
      return;
    }

    if (!this.assetPicker) {
      this.assetPicker = document.createElement('div');
      this.assetPicker.style.position = 'fixed';
      this.assetPicker.style.top = '0';
      this.assetPicker.style.left = '0';
      this.assetPicker.style.right = '0';
      this.assetPicker.style.bottom = '0';
      this.assetPicker.style.display = 'flex';
      this.assetPicker.style.alignItems = 'center';
      this.assetPicker.style.justifyContent = 'center';
      this.assetPicker.style.background = 'rgba(10, 12, 18, 0.7)';
      this.assetPicker.style.zIndex = '2000';

      const panel = document.createElement('div');
      panel.style.background = '#10131b';
      panel.style.padding = '18px';
      panel.style.borderRadius = '12px';
      panel.style.width = '360px';
      panel.style.maxHeight = '70vh';
      panel.style.overflow = 'auto';
      panel.style.boxShadow = '0 18px 40px rgba(0, 0, 0, 0.45)';
      panel.style.display = 'flex';
      panel.style.flexDirection = 'column';
      panel.style.gap = '8px';

      const header = document.createElement('div');
      header.style.display = 'flex';
      header.style.justifyContent = 'space-between';
      header.style.alignItems = 'center';
      header.style.marginBottom = '8px';

      this.assetPickerTitle = document.createElement('span');
      this.assetPickerTitle.style.fontSize = '14px';
      this.assetPickerTitle.style.fontWeight = '700';
      this.assetPickerTitle.style.color = '#e3e8f4';

      const closeButton = createButton('Close', 'danger');
      closeButton.addEventListener('click', () => {
        this.assetPicker.style.display = 'none';
      });

      header.appendChild(this.assetPickerTitle);
      header.appendChild(closeButton);
      panel.appendChild(header);

      this.assetPickerList = document.createElement('div');
      this.assetPickerList.style.display = 'flex';
      this.assetPickerList.style.flexDirection = 'column';
      this.assetPickerList.style.gap = '6px';
      panel.appendChild(this.assetPickerList);

      this.assetPicker.appendChild(panel);
      document.body.appendChild(this.assetPicker);
    }

    this.assetPickerTitle.textContent = `Assign ${slot.label}`;
    this.assetPickerList.innerHTML = '';
    this.assetPickerSlot = slot;

    for (const asset of textures) {
      const row = document.createElement('button');
      row.type = 'button';
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';
      row.style.padding = '8px 10px';
      row.style.border = 'none';
      row.style.borderRadius = '8px';
      row.style.background = 'rgba(255, 255, 255, 0.06)';
      row.style.color = '#e3e8f4';
      row.style.fontSize = '12px';
      row.style.cursor = 'pointer';

      const name = document.createElement('span');
      name.textContent = asset.name || asset.logicalPath || asset.guid;

      const status = document.createElement('span');
      status.textContent = asset.status;
      status.style.fontSize = '11px';
      status.style.color = '#8891a5';

      row.appendChild(name);
      row.appendChild(status);

      row.addEventListener('click', async () => {
        this.assetPicker.style.display = 'none';
        try {
          await this.registry.assignTextureFromAsset(this.currentMaterialId, slot.key, asset);
        } catch (err) {
          console.error('[Materials] Failed to assign texture', err);
          alert('Failed to assign texture. Check the console for details.');
        }
      });

      this.assetPickerList.appendChild(row);
    }

    this.assetPicker.style.display = 'flex';
  }

  _refreshSelection() {
    if (!this.root) {
      return;
    }
    const selected = this.selection.get();
    const meshInstance = selected.find(inst => inst && inst.mesh);

    if (!meshInstance) {
      this.currentInstance = null;
      this.currentMaterialId = null;
      this.currentPrimitive = 0;
      this.materials = [];
      this.instanceLabel.textContent = 'No mesh selected';
      this.materialSelect.innerHTML = '';
      this._setStatus(DEFAULT_MESSAGE);
      this._setTextureLabels();
      return;
    }

    this.currentInstance = meshInstance;
    this.registry.trackInstance(meshInstance);
    this.materials = this.registry.getInstanceMaterials(meshInstance);

    this.instanceLabel.textContent = `Editing: ${meshInstance.Name || meshInstance.ClassName}`;

    this.materialSelect.innerHTML = '';
    for (const entry of this.materials) {
      const option = document.createElement('option');
      option.value = String(entry.primitive);
      option.textContent = `Primitive ${entry.primitive + 1}`;
      this.materialSelect.appendChild(option);
    }

    const first = this.materials.find(m => m.primitive === this.currentPrimitive) || this.materials[0];
    if (!first) {
      this.currentMaterialId = null;
      this._setStatus('Selected mesh has no material assignments');
      return;
    }

    this.currentPrimitive = first.primitive;
    this.currentMaterialId = first.materialId;
    this.materialSelect.value = String(first.primitive);
    this._applyMaterialInfo();
  }

  _selectPrimitive(index) {
    const entry = this.materials.find(mat => mat.primitive === index);
    if (!entry) {
      return;
    }
    this.currentMaterialId = entry.materialId;
    this.currentPrimitive = entry.primitive;
    this._applyMaterialInfo();
  }

  _applyMaterialInfo() {
    if (!this.currentMaterialId) {
      this._setStatus('Material unavailable');
      return;
    }
    const info = this.registry.getMaterialInfo(this.currentMaterialId);
    if (!info) {
      this._setStatus('Material data not available');
      return;
    }

    this._setStatus('');
    const color = info.color ? info.color.slice(0, 3) : [1, 1, 1];
    this.baseColorInput.value = rgbToHex(color);

    const metallic = info.metalness ?? 0;
    this.metallicControl.input.value = String(metallic);
    this.metallicControl.value.textContent = formatValue(metallic);

    const roughness = info.roughness ?? 1;
    this.roughnessControl.input.value = String(roughness);
    this.roughnessControl.value.textContent = formatValue(roughness);

    const { color: emissiveHex, intensity } = decomposeEmissive(info.emissive);
    this.emissiveColorInput.value = emissiveHex;
    this.emissiveIntensity.input.value = String(intensity);
    this.emissiveIntensity.value.textContent = formatValue(intensity, 2);

    this._setTextureLabels(info);
  }

  _setTextureLabels(info = null) {
    for (const slot of MATERIAL_TEXTURE_SLOTS) {
      const ui = this.textureSlots.get(slot.key);
      if (!ui) continue;
      let label = 'Default';
      if (info) {
        const assigned = this.registry.getAssignedAsset(this.currentMaterialId, slot.key);
        if (assigned) {
          label = assigned.name || assigned.logicalPath || assigned.guid || 'Assigned Texture';
        } else if (info.maps?.[slot.key]?.texture) {
          label = 'Custom';
        }
      }
      ui.value.textContent = label;
    }
  }
}
