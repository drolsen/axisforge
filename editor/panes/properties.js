import UndoService from '../services/undo.js';
import { Selection } from '../services/selection.js';
import PropertyGrid from '../ui/propgrid/propgrid.js';
import { isVector3, isColor3, isValidAttribute } from '../../engine/core/types.js';

const VECTOR_PROPS = ['Position', 'Rotation', 'Scale'];
const MIXED_PLACEHOLDER = '—';

const ATTRIBUTE_TYPES = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'Vector3', label: 'Vector3' },
  { value: 'Color3', label: 'Color3' },
  { value: 'JSON', label: 'JSON' },
];

const ATTRIBUTE_DEFAULTS = {
  string: () => '',
  number: () => 0,
  boolean: () => false,
  Vector3: () => ({ x: 0, y: 0, z: 0 }),
  Color3: () => ({ r: 1, g: 1, b: 1 }),
  JSON: () => ({}),
};

function combineCommands(undo, commands) {
  const valid = commands.filter(Boolean);
  if (!valid.length) return;
  if (valid.length === 1) {
    undo.execute(valid[0]);
    return;
  }
  undo.execute({
    undo: () => {
      for (const cmd of [...valid].reverse()) {
        cmd.undo?.();
      }
    },
    redo: () => {
      for (const cmd of valid) {
        cmd.redo?.();
      }
    },
  });
}

function cloneVector(value = {}) {
  return {
    x: Number.isFinite(value.x) ? value.x : 0,
    y: Number.isFinite(value.y) ? value.y : 0,
    z: Number.isFinite(value.z) ? value.z : 0,
  };
}

function cloneColor(value = {}) {
  return {
    r: Number.isFinite(value.r) ? Math.max(0, Math.min(1, value.r)) : 0,
    g: Number.isFinite(value.g) ? Math.max(0, Math.min(1, value.g)) : 0,
    b: Number.isFinite(value.b) ? Math.max(0, Math.min(1, value.b)) : 0,
  };
}

function cloneAttributeValue(value) {
  if (isVector3(value)) return cloneVector(value);
  if (isColor3(value)) return cloneColor(value);
  if (value && typeof value === 'object') {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      // Fallback to shallow clone
      return { ...value };
    }
  }
  return value;
}

function valuesEqual(a, b) {
  if (a === b) return true;
  if (Number.isNaN(a) && Number.isNaN(b)) return true;
  if (isVector3(a) && isVector3(b)) {
    return a.x === b.x && a.y === b.y && a.z === b.z;
  }
  if (isColor3(a) && isColor3(b)) {
    return a.r === b.r && a.g === b.g && a.b === b.b;
  }
  if (typeof a === 'object' && typeof b === 'object') {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  return false;
}

function detectAttributeType(value) {
  const type = typeof value;
  if (type === 'string') return 'string';
  if (type === 'number') return 'number';
  if (type === 'boolean') return 'boolean';
  if (isVector3(value)) return 'Vector3';
  if (isColor3(value)) return 'Color3';
  if (value === undefined) return 'string';
  return 'JSON';
}

function buildScalarField(instances, prop, { accessor = inst => inst[prop], formatter = v => v } = {}) {
  if (!instances.length) return null;
  const values = instances.map(inst => accessor(inst));
  const firstDefined = values.find(v => v !== undefined);
  if (firstDefined === undefined) {
    return { value: null, mixed: false };
  }
  const mixed = values.some(val => !valuesEqual(val, firstDefined));
  return {
    value: mixed ? formatter(firstDefined) : formatter(firstDefined),
    raw: firstDefined,
    mixed,
    values,
  };
}

function buildVectorField(instances, prop) {
  const vectors = instances.map(inst => inst[prop]).filter(value => isVector3(value));
  if (!vectors.length) return null;
  const base = cloneVector(vectors[0]);
  const mixed = { x: false, y: false, z: false };
  for (const vector of vectors.slice(1)) {
    if (base.x !== vector.x) mixed.x = true;
    if (base.y !== vector.y) mixed.y = true;
    if (base.z !== vector.z) mixed.z = true;
  }
  if (vectors.length !== instances.length) {
    mixed.x = true;
    mixed.y = true;
    mixed.z = true;
  }
  return { value: base, mixed };
}

function buildParentField(instances) {
  if (!instances.length) return null;
  const parents = instances.map(inst => inst.Parent ?? null);
  const first = parents.find(parent => parent != null) ?? null;
  let mixed = false;
  for (const parent of parents) {
    if (parent !== first) {
      mixed = true;
      break;
    }
  }
  const label = first ? first.Name ?? first.ClassName ?? 'Instance' : 'None';
  return { parent: first, parents, label, mixed };
}

function buildVisibleField(instances) {
  return buildScalarField(instances, 'Visible', {
    accessor: inst => (inst.Visible === undefined ? true : Boolean(inst.Visible)),
    formatter: value => Boolean(value),
  });
}

function getPrimaryMaterial(inst) {
  if (!inst) return null;
  if (typeof inst.getMaterialForPrimitive === 'function') {
    return inst.getMaterialForPrimitive(0) ?? null;
  }
  if (Array.isArray(inst.materials) && inst.materials.length) {
    return inst.materials[0];
  }
  return inst.Material ?? null;
}

function buildMaterialField(instances) {
  const materials = instances.map(inst => getPrimaryMaterial(inst));
  const first = materials.find(mat => mat != null) ?? null;
  const mixed = materials.some(mat => mat !== first);
  return { value: first, mixed };
}

function buildVectorAttribute(values) {
  const vectors = values.filter(val => isVector3(val));
  if (!vectors.length) {
    return { value: { x: 0, y: 0, z: 0 }, mixed: { x: true, y: true, z: true } };
  }
  const base = cloneVector(vectors[0]);
  const mixed = { x: false, y: false, z: false };
  for (const vec of vectors.slice(1)) {
    if (base.x !== vec.x) mixed.x = true;
    if (base.y !== vec.y) mixed.y = true;
    if (base.z !== vec.z) mixed.z = true;
  }
  if (vectors.length !== values.length) {
    mixed.x = true;
    mixed.y = true;
    mixed.z = true;
  }
  return { value: base, mixed };
}

function buildColorAttribute(values) {
  const colors = values.filter(val => isColor3(val));
  if (!colors.length) {
    return { value: { r: 1, g: 1, b: 1 }, mixed: true };
  }
  const base = cloneColor(colors[0]);
  let mixed = false;
  for (const color of colors.slice(1)) {
    if (base.r !== color.r || base.g !== color.g || base.b !== color.b) {
      mixed = true;
      break;
    }
  }
  if (colors.length !== values.length) mixed = true;
  return { value: base, mixed };
}

function buildAttributes(instances) {
  const keys = new Set();
  for (const inst of instances) {
    if (!inst?.Attributes) continue;
    for (const key of inst.Attributes.keys()) {
      keys.add(key);
    }
  }
  const result = [];
  for (const key of keys) {
    const values = instances.map(inst => inst?.GetAttribute?.(key));
    const defined = values.filter(value => value !== undefined);
    const type = detectAttributeType(defined[0]);
    const entry = { name: key, type, values, mixed: false };
    if (type === 'Vector3') {
      const vectorData = buildVectorAttribute(values);
      entry.value = vectorData.value;
      entry.mixed = vectorData.mixed;
    } else if (type === 'Color3') {
      const colorData = buildColorAttribute(values);
      entry.value = colorData.value;
      entry.mixed = colorData.mixed;
    } else if (type === 'JSON') {
      const base = defined[0] ?? {};
      entry.value = JSON.stringify(base, null, 2);
      entry.mixed = values.some(val => !valuesEqual(val, base));
    } else {
      const base = defined[0];
      entry.value = base;
      entry.mixed = values.some(val => !valuesEqual(val, base));
    }
    entry.presentInAll = values.every(value => value !== undefined);
    result.push(entry);
  }
  result.sort((a, b) => a.name.localeCompare(b.name));
  return result;
}

function formatSelectionStatus(count) {
  if (count <= 0) return 'Select an object to edit its properties.';
  if (count === 1) return '1 object selected';
  return `${count} objects selected`;
}

function ensureArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function sanitizeAttributeName(name) {
  return String(name ?? '').trim();
}

export default class Properties {
  constructor(undo = new UndoService(), selection = new Selection()) {
    this.undo = undo;
    this.selection = selection;
    this.boundInstances = [];
    this.boundConnections = [];
    this.current = null;
    this._listeners = new Set();
    this.hasDOM = typeof document !== 'undefined' && typeof document.createElement === 'function';

    if (this.hasDOM) {
      this.element = document.createElement('div');
      this.element.className = 'properties-pane';
      this.grid = new PropertyGrid();
      this.grid.setEmptyMessage('Select an object to edit its properties.');
      this.element.appendChild(this.grid.getElement());
      this.statusElement = document.createElement('div');
      this.statusElement.className = 'properties-pane__status';
      this.element.appendChild(this.statusElement);
    } else {
      this.element = null;
      this.grid = null;
      this.statusElement = null;
    }

    this.selectionConnection = this.selection.Changed.Connect(sel => {
      this._bindInstances(sel);
    });

    this._bindInstances(this.selection.get());
  }

  dispose() {
    if (this.selectionConnection) this.selectionConnection.Disconnect();
    this._disconnectBound();
    this._listeners.clear();
    this.grid?.dispose?.();
  }

  getElement() {
    return this.element;
  }

  getCurrent() {
    return this.current;
  }

  onChange(listener) {
    if (typeof listener !== 'function') return () => {};
    this._listeners.add(listener);
    if (this.current) {
      try {
        listener(this.current);
      } catch (err) {
        console.error('[Properties] onChange listener error', err);
      }
    }
    return () => {
      this._listeners.delete(listener);
    };
  }

  editName(value) {
    const text = String(value ?? '');
    const commands = this.boundInstances.map(inst => this.undo.setProperty(inst, 'Name', text));
    combineCommands(this.undo, commands);
  }

  editVectorComponent(prop, axis, value) {
    if (!VECTOR_PROPS.includes(prop)) return;
    const num = Number(value);
    if (!Number.isFinite(num)) return;
    const commands = [];
    for (const inst of this.boundInstances) {
      const current = cloneVector(inst[prop]);
      if (current[axis] === num) continue;
      const next = { ...current, [axis]: num };
      commands.push(this.undo.setProperty(inst, prop, next));
    }
    combineCommands(this.undo, commands);
  }

  editBoolean(prop, value) {
    const bool = Boolean(value);
    const commands = this.boundInstances
      .filter(inst => prop in inst || inst[prop] !== undefined)
      .map(inst => this.undo.setProperty(inst, prop, bool));
    combineCommands(this.undo, commands);
  }

  editAttribute(name, type, value) {
    const attrName = sanitizeAttributeName(name);
    if (!attrName) return;
    let prepared = value;
    if (type === 'string') {
      prepared = String(value ?? '');
    } else if (type === 'number') {
      const num = Number(value);
      if (!Number.isFinite(num)) return;
      prepared = num;
    } else if (type === 'boolean') {
      prepared = Boolean(value);
    } else if (type === 'Color3') {
      prepared = cloneColor(value);
    } else if (type === 'JSON') {
      try {
        prepared = typeof value === 'string' ? JSON.parse(value) : value;
      } catch {
        console.warn('[Properties] Failed to parse JSON attribute', attrName);
        return;
      }
    }
    if (!isValidAttribute(prepared)) {
      console.warn('[Properties] Invalid attribute value for', attrName);
      return;
    }
    const commands = this.boundInstances.map(inst => this.undo.setAttribute(inst, attrName, cloneAttributeValue(prepared)));
    combineCommands(this.undo, commands);
  }

  editAttributeVectorComponent(name, axis, value) {
    const attrName = sanitizeAttributeName(name);
    if (!attrName || !['x', 'y', 'z'].includes(axis)) return;
    const num = Number(value);
    if (!Number.isFinite(num)) return;
    const commands = [];
    for (const inst of this.boundInstances) {
      const current = inst.GetAttribute(attrName);
      const base = isVector3(current) ? cloneVector(current) : { x: 0, y: 0, z: 0 };
      if (base[axis] === num) continue;
      const next = { ...base, [axis]: num };
      commands.push(this.undo.setAttribute(inst, attrName, next));
    }
    combineCommands(this.undo, commands);
  }

  editAttributeColor(name, color) {
    const attrName = sanitizeAttributeName(name);
    if (!attrName) return;
    const prepared = cloneColor(color);
    const commands = this.boundInstances.map(inst => this.undo.setAttribute(inst, attrName, prepared));
    combineCommands(this.undo, commands);
  }

  editAttributeJSON(name, text) {
    const attrName = sanitizeAttributeName(name);
    if (!attrName) return;
    let parsed;
    try {
      parsed = typeof text === 'string' ? JSON.parse(text) : text;
    } catch {
      console.warn('[Properties] Invalid JSON for attribute', attrName);
      return;
    }
    if (!isValidAttribute(parsed)) {
      console.warn('[Properties] Invalid attribute value for', attrName);
      return;
    }
    const commands = this.boundInstances.map(inst => this.undo.setAttribute(inst, attrName, cloneAttributeValue(parsed)));
    combineCommands(this.undo, commands);
  }

  removeAttribute(name) {
    const attrName = sanitizeAttributeName(name);
    if (!attrName) return;
    const commands = this.boundInstances.map(inst => this.undo.removeAttribute(inst, attrName));
    combineCommands(this.undo, commands);
  }

  addAttribute(name, type) {
    const attrName = sanitizeAttributeName(name);
    if (!attrName) return false;
    const factory = ATTRIBUTE_DEFAULTS[type] ?? ATTRIBUTE_DEFAULTS.string;
    const commands = this.boundInstances.map(inst => this.undo.setAttribute(inst, attrName, factory()));
    combineCommands(this.undo, commands);
    return true;
  }

  _bindInstances(instances) {
    this._disconnectBound();
    this.boundInstances = ensureArray(instances);
    this.current = this._buildState();
    this._updateView();
    this._emitChange();

    for (const inst of this.boundInstances) {
      if (!inst?.Changed) continue;
      const conn = inst.Changed.Connect(() => {
        this.current = this._buildState();
        this._updateView();
        this._emitChange();
      });
      this.boundConnections.push(conn);
    }
  }

  _disconnectBound() {
    for (const conn of this.boundConnections) {
      try {
        conn?.Disconnect?.();
      } catch (err) {
        console.warn('[Properties] Failed to disconnect listener', err);
      }
    }
    this.boundConnections = [];
  }

  _buildState() {
    const instances = this.boundInstances;
    if (!instances.length) return null;
    const state = {
      instances,
      count: instances.length,
      Name: buildScalarField(instances, 'Name', {
        accessor: inst => inst.Name ?? '',
        formatter: value => value ?? '',
      }),
      Parent: buildParentField(instances),
      Visible: buildVisibleField(instances),
      Material: buildMaterialField(instances),
      Attributes: buildAttributes(instances),
    };
    for (const prop of VECTOR_PROPS) {
      state[prop] = buildVectorField(instances, prop);
    }
    return state;
  }

  _emitChange() {
    for (const listener of this._listeners) {
      try {
        listener(this.current);
      } catch (err) {
        console.error('[Properties] onChange listener error', err);
      }
    }
  }

  _updateView() {
    if (this.statusElement) {
      this.statusElement.textContent = formatSelectionStatus(this.current?.count ?? 0);
    }
    if (!this.grid) return;
    if (!this.current) {
      this.grid.setSections([]);
      return;
    }
    const sections = this._buildSections(this.current);
    this.grid.setSections(sections);
  }

  _buildSections(state) {
    const sections = [];

    const dataRows = [];
    if (state.Name) {
      dataRows.push({
        id: 'prop-name',
        label: 'Name',
        type: 'text',
        value: state.Name.mixed ? '' : state.Name.value,
        placeholder: state.Name.mixed ? MIXED_PLACEHOLDER : '',
        mixed: state.Name.mixed,
        onCommit: value => this.editName(value),
      });
    }
    if (state.Parent) {
      dataRows.push({
        id: 'prop-parent',
        label: 'Parent',
        type: 'text',
        value: state.Parent.mixed ? '' : state.Parent.label,
        placeholder: state.Parent.mixed ? MIXED_PLACEHOLDER : state.Parent.label,
        readOnly: true,
        mixed: state.Parent.mixed,
        actions: state.Parent.mixed || !state.Parent.parent
          ? []
          : [{
              text: 'Select',
              label: 'Select parent',
              onClick: () => {
                if (state.Parent.parent) this.selection.set([state.Parent.parent]);
              },
            }],
      });
    }
    if (dataRows.length) {
      sections.push({ id: 'section-data', label: 'Data', rows: dataRows });
    }

    const transformRows = [];
    for (const prop of VECTOR_PROPS) {
      const vector = state[prop];
      if (!vector) continue;
      transformRows.push({
        id: `prop-${prop.toLowerCase()}`,
        label: prop,
        type: 'vector3',
        value: vector.value,
        mixed: vector.mixed,
        options: { precision: 3 },
        onCommit: ({ axis, value }) => this.editVectorComponent(prop, axis, value),
      });
    }
    if (transformRows.length) {
      sections.push({ id: 'section-transform', label: 'Transform', rows: transformRows });
    }

    const appearanceRows = [];
    if (state.Visible) {
      appearanceRows.push({
        id: 'prop-visible',
        label: 'Visible',
        type: 'bool',
        value: Boolean(state.Visible.value),
        mixed: state.Visible.mixed,
        onCommit: value => this.editBoolean('Visible', value),
      });
    }
    if (state.Material) {
      appearanceRows.push({
        id: 'prop-material',
        label: 'Material',
        type: 'text',
        readOnly: true,
        value: state.Material.mixed ? '' : state.Material.value ?? 'None',
        placeholder: state.Material.mixed ? MIXED_PLACEHOLDER : 'None',
        mixed: state.Material.mixed,
      });
    }
    if (appearanceRows.length) {
      sections.push({ id: 'section-appearance', label: 'Appearance', rows: appearanceRows });
    }

    const attributeRows = [];
    for (const attribute of state.Attributes) {
      const editorType = this._editorTypeForAttribute(attribute.type);
      const row = {
        id: `attr-${attribute.name}`,
        label: attribute.name,
        type: editorType,
        value: attribute.type === 'string'
          ? (attribute.mixed ? '' : attribute.value ?? '')
          : attribute.type === 'number'
            ? (attribute.mixed ? null : attribute.value ?? 0)
            : attribute.type === 'JSON'
              ? (attribute.mixed ? '' : attribute.value ?? '')
              : attribute.value,
        mixed: attribute.mixed,
        options: {},
        actions: [{
          text: 'Remove',
          label: 'Remove attribute',
          onClick: () => this.removeAttribute(attribute.name),
        }],
      };
      if (attribute.type === 'string') {
        row.placeholder = attribute.mixed ? MIXED_PLACEHOLDER : '';
        row.onCommit = value => this.editAttribute(attribute.name, 'string', value);
      } else if (attribute.type === 'number') {
        row.placeholder = attribute.mixed ? MIXED_PLACEHOLDER : '';
        row.onCommit = value => this.editAttribute(attribute.name, 'number', value);
      } else if (attribute.type === 'boolean') {
        row.onCommit = value => this.editAttribute(attribute.name, 'boolean', value);
      } else if (attribute.type === 'Vector3') {
        row.onCommit = ({ axis, value }) => this.editAttributeVectorComponent(attribute.name, axis, value);
        row.options = { precision: 3 };
      } else if (attribute.type === 'Color3') {
        row.onCommit = value => this.editAttributeColor(attribute.name, value);
      } else if (attribute.type === 'JSON') {
        row.type = 'text';
        row.options = { multiline: true, monospace: true };
        row.onCommit = value => this.editAttributeJSON(attribute.name, value);
        row.placeholder = attribute.mixed ? MIXED_PLACEHOLDER : '';
      } else {
        row.onCommit = value => this.editAttribute(attribute.name, attribute.type, value);
      }
      attributeRows.push(row);
    }

    attributeRows.push({
      id: 'attr-add',
      label: 'Add Attribute',
      type: 'custom',
      options: {
        render: element => this._renderAttributeCreator(element),
      },
    });

    sections.push({ id: 'section-attributes', label: 'Attributes', rows: attributeRows });

    return sections;
  }

  _editorTypeForAttribute(type) {
    if (type === 'Vector3') return 'vector3';
    if (type === 'Color3') return 'color3';
    if (type === 'boolean') return 'bool';
    if (type === 'number') return 'number';
    return 'text';
  }

  _renderAttributeCreator(container) {
    container.classList.add('property-editor--add-attribute');
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'property-editor__field';
    nameInput.placeholder = 'Attribute Name';

    const typeSelect = document.createElement('select');
    typeSelect.className = 'property-editor__select';
    for (const option of ATTRIBUTE_TYPES) {
      const element = document.createElement('option');
      element.value = option.value;
      element.textContent = option.label;
      typeSelect.appendChild(element);
    }

    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'property-grid__action property-grid__action--primary';
    addButton.textContent = 'Add';

    const resetInputs = () => {
      nameInput.value = '';
      typeSelect.value = ATTRIBUTE_TYPES[0].value;
      nameInput.focus();
    };

    const submit = () => {
      const added = this.addAttribute(nameInput.value, typeSelect.value);
      if (added) {
        resetInputs();
      }
    };

    addButton.addEventListener('click', submit);
    nameInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        submit();
      }
    });

    container.append(nameInput, typeSelect, addButton);
    return {
      dispose() {
        // no-op
      },
    };
  }
}
