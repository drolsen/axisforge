import { PRESET_STORAGE_KEY } from '../ui/dock/dock.js';
import { ROBLOX_LAYOUT } from '../ui/dock/defaultLayout.js';
import { showToast } from '../ui/toast.js';

function cloneLayout(layout) {
  if (!layout) return null;
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(layout);
    } catch (err) {
      // fall through to JSON clone
    }
  }
  try {
    return JSON.parse(JSON.stringify(layout));
  } catch (err) {
    console.warn('[LayoutPresets] Failed to clone layout', err);
    return null;
  }
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

export default class LayoutPresetsPane {
  constructor({ dock, onLayoutApplied, onPresetSaved, onPresetDeleted, onReset } = {}) {
    this.dock = dock;
    this.onLayoutApplied = typeof onLayoutApplied === 'function' ? onLayoutApplied : null;
    this.onPresetSaved = typeof onPresetSaved === 'function' ? onPresetSaved : null;
    this.onPresetDeleted = typeof onPresetDeleted === 'function' ? onPresetDeleted : null;
    this.onReset = typeof onReset === 'function' ? onReset : null;

    this.builtinPresets = [
      { name: 'Roblox', layout: cloneLayout(ROBLOX_LAYOUT) },
    ];
    this.userPresets = new Map();
    this.selectedPreset = null;
    this.modalMode = null;

    this._createUI();
    this._loadPresets();
    this._renderList();
  }

  open() {
    this._loadPresets();
    this._renderList();
    this.root.hidden = false;
    this.root.setAttribute('aria-hidden', 'false');
    this.dialog.focus();
    window.addEventListener('keydown', this._handleKeyDown, { passive: false });
  }

  close() {
    this.root.hidden = true;
    this.root.setAttribute('aria-hidden', 'true');
    window.removeEventListener('keydown', this._handleKeyDown);
  }

  _createUI() {
    this.root = document.createElement('div');
    this.root.className = 'layout-presets';
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-hidden', 'true');

    this.dialog = document.createElement('div');
    this.dialog.className = 'layout-presets__dialog';
    this.dialog.tabIndex = -1;

    const header = document.createElement('div');
    header.className = 'layout-presets__header';
    header.textContent = 'Layout Presets';

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'layout-presets__close';
    closeButton.setAttribute('aria-label', 'Close');
    closeButton.innerHTML = '&times;';
    closeButton.addEventListener('click', () => this.close());
    header.appendChild(closeButton);

    const body = document.createElement('div');
    body.className = 'layout-presets__body';

    this.list = document.createElement('ul');
    this.list.className = 'layout-presets__list';
    this.list.setAttribute('role', 'listbox');

    body.appendChild(this.list);

    this.buttons = document.createElement('div');
    this.buttons.className = 'layout-presets__buttons';

    this.saveButton = this._createButton('Save Current as…', () => this._handleSaveCurrent());
    this.applyButton = this._createButton('Apply', () => this._handleApply());
    this.renameButton = this._createButton('Rename', () => this._handleRename());
    this.deleteButton = this._createButton('Delete', () => this._handleDelete());
    this.resetButton = this._createButton('Reset to Default', () => this._handleReset());
    this.exportButton = this._createButton('Export', () => this._handleExport());
    this.importButton = this._createButton('Import', () => this._handleImport());

    this.buttons.append(
      this.saveButton,
      this.applyButton,
      this.renameButton,
      this.deleteButton,
      this.resetButton,
      this.exportButton,
      this.importButton,
    );

    body.appendChild(this.buttons);

    this.dialog.append(header, body);
    this.root.appendChild(this.dialog);

    this.modal = document.createElement('div');
    this.modal.className = 'layout-presets__modal';
    this.modal.hidden = true;

    const modalContent = document.createElement('div');
    modalContent.className = 'layout-presets__modal-content';

    this.modalMessage = document.createElement('div');
    modalContent.appendChild(this.modalMessage);

    this.modalTextarea = document.createElement('textarea');
    modalContent.appendChild(this.modalTextarea);

    const modalActions = document.createElement('div');
    modalActions.className = 'layout-presets__modal-actions';

    this.modalCancel = document.createElement('button');
    this.modalCancel.type = 'button';
    this.modalCancel.textContent = 'Cancel';
    this.modalCancel.addEventListener('click', () => this._closeModal());

    this.modalConfirm = document.createElement('button');
    this.modalConfirm.type = 'button';
    this.modalConfirm.textContent = 'Import';
    this.modalConfirm.addEventListener('click', () => this._confirmModal());

    modalActions.append(this.modalCancel, this.modalConfirm);
    modalContent.appendChild(modalActions);
    this.modal.appendChild(modalContent);

    this.modal.addEventListener('click', event => {
      if (event.target === this.modal) {
        this._closeModal();
      }
    });

    document.body.append(this.root, this.modal);

    this._handleKeyDown = event => {
      if (event.key === 'Escape') {
        if (!this.modal.hidden) {
          this._closeModal();
          event.preventDefault();
        } else if (!this.root.hidden) {
          this.close();
          event.preventDefault();
        }
      }
    };
  }

  _createButton(label, handler) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', handler);
    return button;
  }

  _isBuiltin(name) {
    return this.builtinPresets.some(preset => preset.name === name);
  }

  _getAllPresets() {
    const items = [];
    for (const preset of this.builtinPresets) {
      items.push({ ...preset, builtin: true });
    }
    for (const [name, layout] of this.userPresets.entries()) {
      items.push({ name, layout, builtin: false });
    }
    return items;
  }

  _getPresetByName(name) {
    if (!name) return null;
    const builtin = this.builtinPresets.find(preset => preset.name === name);
    if (builtin) {
      return { name: builtin.name, layout: cloneLayout(builtin.layout), builtin: true };
    }
    if (this.userPresets.has(name)) {
      return { name, layout: cloneLayout(this.userPresets.get(name)), builtin: false };
    }
    return null;
  }

  _loadPresets() {
    this.userPresets.clear();
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      const raw = localStorage.getItem(PRESET_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!isPlainObject(parsed)) return;
      for (const [name, layout] of Object.entries(parsed)) {
        if (!name || !isPlainObject(layout)) {
          continue;
        }
        if (this._isBuiltin(name)) {
          continue;
        }
        const cloned = cloneLayout(layout);
        if (cloned) {
          this.userPresets.set(name, cloned);
        }
      }
    } catch (err) {
      console.warn('[LayoutPresets] Failed to load presets', err);
    }
  }

  _savePresets() {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      const data = {};
      for (const [name, layout] of this.userPresets.entries()) {
        data[name] = cloneLayout(layout) || layout;
      }
      localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      console.warn('[LayoutPresets] Failed to save presets', err);
      showToast('Unable to save presets', 'error', 1600);
    }
  }

  _renderList() {
    this.list.innerHTML = '';
    const presets = this._getAllPresets();
    if (!presets.length) {
      const empty = document.createElement('div');
      empty.className = 'layout-presets__empty';
      empty.textContent = 'No presets saved yet.';
      this.list.appendChild(empty);
      this.selectedPreset = null;
      this._updateButtons();
      return;
    }

    if (!this.selectedPreset || !presets.some(item => item.name === this.selectedPreset)) {
      const defaultPreset = presets[0];
      this.selectedPreset = defaultPreset?.name || null;
    }

    for (const preset of presets) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'layout-presets__item';
      button.dataset.preset = preset.name;
      button.dataset.selected = preset.name === this.selectedPreset ? 'true' : 'false';
      button.dataset.builtin = preset.builtin ? 'true' : 'false';

      const nameLabel = document.createElement('span');
      nameLabel.textContent = preset.name;
      button.appendChild(nameLabel);

      if (preset.builtin) {
        const badge = document.createElement('span');
        badge.textContent = 'Default';
        badge.style.fontSize = '11px';
        badge.style.opacity = '0.75';
        button.appendChild(badge);
      }

      button.addEventListener('click', () => {
        this._selectPreset(preset.name, true);
      });
      button.addEventListener('dblclick', () => {
        this._selectPreset(preset.name, false);
        this._handleApply();
      });

      item.appendChild(button);
      this.list.appendChild(item);
    }

    this._updateButtons();
  }

  _selectPreset(name, focus = false) {
    this.selectedPreset = name;
    for (const button of this.list.querySelectorAll('.layout-presets__item')) {
      button.dataset.selected = button.dataset.preset === name ? 'true' : 'false';
    }
    this._updateButtons();
    if (focus) {
      const target = this.list.querySelector(`.layout-presets__item[data-preset="${CSS.escape(name)}"]`);
      target?.focus?.();
    }
  }

  _updateButtons() {
    const hasSelection = Boolean(this.selectedPreset);
    this.applyButton.disabled = !hasSelection;
    const isBuiltin = hasSelection && this._isBuiltin(this.selectedPreset);
    this.renameButton.disabled = !hasSelection || isBuiltin;
    this.deleteButton.disabled = !hasSelection || isBuiltin;
  }

  _handleSaveCurrent() {
    if (!this.dock) return;
    const layout = this.dock.serializeLayout();
    if (!layout) {
      showToast('No layout available to save', 'warn', 1600);
      return;
    }
    const name = window.prompt('Preset name');
    if (!name) {
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    if (this._isBuiltin(trimmed)) {
      showToast('Cannot overwrite the default preset', 'warn', 1600);
      return;
    }
    if (this.userPresets.has(trimmed)) {
      const overwrite = window.confirm(`Overwrite preset "${trimmed}"?`);
      if (!overwrite) {
        return;
      }
    }
    this.userPresets.set(trimmed, layout);
    this._savePresets();
    this._renderList();
    this._selectPreset(trimmed);
    showToast(`Saved layout "${trimmed}"`, 'success', 1600);
    if (this.onPresetSaved) {
      this.onPresetSaved(trimmed);
    }
  }

  _handleApply() {
    if (!this.dock || !this.selectedPreset) {
      return;
    }
    const preset = this._getPresetByName(this.selectedPreset);
    if (!preset || !preset.layout) {
      showToast('Preset is invalid', 'error', 1600);
      return;
    }
    const applied = this.dock.deserializeLayout(preset.layout);
    if (!applied) {
      showToast('Unable to apply preset', 'error', 1600);
      return;
    }
    this.close();
    if (this.onLayoutApplied) {
      this.onLayoutApplied(preset.name, preset.builtin);
    }
  }

  _handleRename() {
    if (!this.selectedPreset || this._isBuiltin(this.selectedPreset)) {
      return;
    }
    const currentName = this.selectedPreset;
    const newName = window.prompt('Rename preset', currentName);
    if (!newName) {
      return;
    }
    const trimmed = newName.trim();
    if (!trimmed || trimmed === currentName) {
      return;
    }
    if (this._isBuiltin(trimmed)) {
      showToast('Name reserved for default presets', 'warn', 1600);
      return;
    }
    const layout = this.userPresets.get(currentName);
    this.userPresets.delete(currentName);
    this.userPresets.set(trimmed, layout);
    this._savePresets();
    this._renderList();
    this._selectPreset(trimmed);
    showToast(`Renamed preset to "${trimmed}"`, 'success', 1600);
    if (this.onPresetSaved) {
      this.onPresetSaved(trimmed);
    }
  }

  _handleDelete() {
    if (!this.selectedPreset || this._isBuiltin(this.selectedPreset)) {
      return;
    }
    const confirmed = window.confirm(`Delete preset "${this.selectedPreset}"?`);
    if (!confirmed) {
      return;
    }
    const name = this.selectedPreset;
    this.userPresets.delete(name);
    this._savePresets();
    this.selectedPreset = null;
    this._renderList();
    showToast(`Deleted preset "${name}"`, 'info', 1400);
    if (this.onPresetDeleted) {
      this.onPresetDeleted(name);
    }
  }

  _handleReset() {
    if (!this.dock) return;
    this.dock.resetToDefault();
    this.close();
    showToast('Layout reset to default', 'success', 1600);
    if (this.onReset) {
      this.onReset();
    }
  }

  _handleExport() {
    const presets = {};
    for (const preset of this.builtinPresets) {
      presets[preset.name] = cloneLayout(preset.layout) || preset.layout;
    }
    for (const [name, layout] of this.userPresets.entries()) {
      presets[name] = cloneLayout(layout) || layout;
    }
    const payload = { version: 1, presets };
    const json = JSON.stringify(payload, null, 2);
    this._openModal({
      mode: 'export',
      title: 'Export Layout Presets',
      confirmLabel: 'Close',
      editable: false,
      value: json,
    });
    if (typeof navigator?.clipboard?.writeText === 'function') {
      navigator.clipboard.writeText(json).catch(() => {});
    }
  }

  _handleImport() {
    this._openModal({
      mode: 'import',
      title: 'Import Layout Presets',
      confirmLabel: 'Import',
      editable: true,
      value: '',
    });
  }

  _openModal({ mode, title, confirmLabel, editable, value }) {
    this.modalMode = mode;
    this.modalMessage.textContent = title || '';
    this.modalTextarea.value = value || '';
    this.modalTextarea.readOnly = !editable;
    this.modalTextarea.placeholder = editable ? '{ "presets": { "My Layout": { … } } }' : '';
    this.modalConfirm.textContent = confirmLabel || 'OK';
    this.modal.hidden = false;
    this.modalTextarea.focus();
    this.modalTextarea.select();
    window.addEventListener('keydown', this._handleKeyDown, { passive: false });
  }

  _closeModal() {
    this.modal.hidden = true;
    this.modalMode = null;
    this.modalTextarea.value = '';
    this.modalTextarea.readOnly = false;
    window.removeEventListener('keydown', this._handleKeyDown);
  }

  _confirmModal() {
    if (this.modalMode === 'export') {
      this._closeModal();
      return;
    }
    if (this.modalMode === 'import') {
      const raw = this.modalTextarea.value;
      if (!raw) {
        showToast('Paste JSON to import presets', 'warn', 1600);
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        const incoming = this._extractPresets(parsed);
        if (!incoming.size) {
          showToast('No presets found in JSON', 'warn', 1600);
          return;
        }
        for (const [name, layout] of incoming.entries()) {
          this.userPresets.set(name, layout);
        }
        this._savePresets();
        this._renderList();
        this._closeModal();
        showToast(`Imported ${incoming.size} preset${incoming.size === 1 ? '' : 's'}`, 'success', 1600);
      } catch (err) {
        console.warn('[LayoutPresets] Failed to import presets', err);
        showToast('Invalid JSON, unable to import presets', 'error', 1800);
      }
      return;
    }
    this._closeModal();
  }

  _extractPresets(data) {
    const map = new Map();
    if (!data || typeof data !== 'object') {
      return map;
    }
    const source = isPlainObject(data.presets) ? data.presets : data;
    for (const [name, layout] of Object.entries(source)) {
      if (!name || !isPlainObject(layout)) {
        continue;
      }
      if (this._isBuiltin(name)) {
        continue;
      }
      const cloned = cloneLayout(layout);
      if (cloned) {
        map.set(name, cloned);
      }
    }
    return map;
  }
}
