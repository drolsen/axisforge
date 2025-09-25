import UndoService from '../services/undo.js';
import { Selection } from '../services/selection.js';

const VECTOR_PROPS = ['Position', 'Rotation', 'Scale'];

function cloneVector(value = {}) {
  return {
    x: typeof value.x === 'number' ? value.x : 0,
    y: typeof value.y === 'number' ? value.y : 0,
    z: typeof value.z === 'number' ? value.z : 0,
  };
}

function buildVectorField(instances, prop) {
  const vectors = instances.map(inst => cloneVector(inst[prop]));
  if (!vectors.length) {
    return { value: cloneVector(), mixed: { x: false, y: false, z: false } };
  }

  const base = vectors[0];
  const mixed = { x: false, y: false, z: false };
  for (const vec of vectors.slice(1)) {
    for (const axis of ['x', 'y', 'z']) {
      if (base[axis] !== vec[axis]) {
        mixed[axis] = true;
      }
    }
  }

  return { value: { ...base }, mixed };
}

function buildNameField(instances) {
  if (!instances.length) return { value: '', mixed: false };
  const name = instances[0].Name ?? '';
  const mixed = instances.some(inst => (inst.Name ?? '') !== name);
  return { value: mixed ? '' : name, mixed };
}

function combineCommands(undo, commands) {
  if (!commands.length) return;
  if (commands.length === 1) {
    undo.execute(commands[0]);
    return;
  }

  undo.execute({
    undo: () => {
      for (const cmd of [...commands].reverse()) {
        cmd.undo();
      }
    },
    redo: () => {
      for (const cmd of commands) {
        cmd.redo();
      }
    },
  });
}

// Minimal properties pane. Editing a numeric property pushes an undo entry.
export default class Properties {
  constructor(undo = new UndoService(), selection = new Selection()) {
    this.undo = undo;
    this.selection = selection;
    this.boundInstances = [];
    this.boundConnections = [];
    this.current = null;
    this._listeners = new Set();

    this.selectionConnection = this.selection.Changed.Connect(sel => {
      this._bindInstances(sel);
    });

    this._bindInstances(this.selection.get());
  }

  dispose() {
    if (this.selectionConnection) this.selectionConnection.Disconnect();
    this._disconnectBound();
    this._listeners.clear();
  }

  getCurrent() {
    return this.current;
  }

  onChange(listener) {
    if (typeof listener !== 'function') {
      return () => {};
    }
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

  editNumber(inst, prop, value) {
    const num = Number(value);
    if (Number.isNaN(num)) return;
    this.undo.execute(this.undo.setProperty(inst, prop, num));
  }

  editName(value) {
    const text = String(value ?? '');
    const commands = this.boundInstances.map(inst => this.undo.setProperty(inst, 'Name', text));
    combineCommands(this.undo, commands);
  }

  editVectorComponent(prop, axis, value) {
    if (!VECTOR_PROPS.includes(prop)) return;
    const num = Number(value);
    if (Number.isNaN(num)) return;

    const commands = [];
    for (const inst of this.boundInstances) {
      const current = cloneVector(inst[prop]);
      if (current[axis] === num) continue;
      const next = { ...current, [axis]: num };
      commands.push({
        undo: () => inst.setProperty(prop, { ...current }),
        redo: () => inst.setProperty(prop, { ...next }),
      });
    }

    combineCommands(this.undo, commands);
  }

  _bindInstances(instances) {
    this._disconnectBound();
    this.boundInstances = [...instances];
    this.current = this._buildState();
    this._emitChange();

    for (const inst of this.boundInstances) {
      this.boundConnections.push(
        inst.Changed.Connect(prop => {
          if (prop === 'Name' || VECTOR_PROPS.includes(prop)) {
            this.current = this._buildState();
            this._emitChange();
          }
        }),
      );
    }
  }

  _disconnectBound() {
    for (const conn of this.boundConnections) {
      conn.Disconnect();
    }
    this.boundConnections = [];
  }

  _buildState() {
    const instances = this.boundInstances;
    return {
      Name: buildNameField(instances),
      Position: buildVectorField(instances, 'Position'),
      Rotation: buildVectorField(instances, 'Rotation'),
      Scale: buildVectorField(instances, 'Scale'),
    };
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
}
