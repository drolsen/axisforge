import UndoService from '../services/undo.js';
import { Selection } from '../services/selection.js';

const TOOL_MODES = ['select', 'move', 'rotate', 'scale'];

function cloneVector(value = {}) {
  return {
    x: typeof value.x === 'number' ? value.x : 0,
    y: typeof value.y === 'number' ? value.y : 0,
    z: typeof value.z === 'number' ? value.z : 0,
  };
}

function vectorsEqual(a, b) {
  if (!a || !b) return false;
  return a.x === b.x && a.y === b.y && a.z === b.z;
}

function createTransformCommand(inst, beforeState, afterState) {
  if (!inst || !beforeState || !afterState) {
    return null;
  }

  const changes = [];
  if (beforeState.position && afterState.position && !vectorsEqual(beforeState.position, afterState.position)) {
    changes.push({
      property: 'Position',
      before: cloneVector(beforeState.position),
      after: cloneVector(afterState.position),
    });
  }
  if (beforeState.rotation && afterState.rotation && !vectorsEqual(beforeState.rotation, afterState.rotation)) {
    changes.push({
      property: 'Rotation',
      before: cloneVector(beforeState.rotation),
      after: cloneVector(afterState.rotation),
    });
  }
  if (beforeState.scale && afterState.scale && !vectorsEqual(beforeState.scale, afterState.scale)) {
    changes.push({
      property: 'Scale',
      before: cloneVector(beforeState.scale),
      after: cloneVector(afterState.scale),
    });
  }

  if (!changes.length) {
    return null;
  }

  return {
    undo: () => {
      for (const change of changes) {
        inst.setProperty(change.property, { ...change.before });
      }
    },
    redo: () => {
      for (const change of changes) {
        inst.setProperty(change.property, { ...change.after });
      }
    },
  };
}

function snapDelta(delta, step) {
  if (!step || !Number.isFinite(step) || step <= 0) {
    return delta;
  }
  return Math.round(delta / step) * step;
}

export default class TransformGizmos {
  constructor(selection = new Selection(), undo = new UndoService()) {
    this.selection = selection;
    this.undo = undo;
    this.targets = this.selection.get();
    this.mode = 'select';
    this.axis = null;
    this.snap = {
      translate: null,
      rotate: null,
      scale: null,
    };
    this.transformSpace = this.selection.getTransformSpace?.() ?? 'global';
    this.pivotMode = this.selection.getPivotMode?.() ?? 'pivot';
    this.dragState = null;
    this._listeners = new Set();

    this.selectionConn = this.selection.Changed.Connect(sel => {
      this.targets = [...sel];
      this._resetDrag();
      this._emit();
    });

    this.settingsConn = this.selection.TransformSettingsChanged?.Connect?.(settings => {
      if (!settings) return;
      this.transformSpace = settings.space ?? this.transformSpace;
      this.pivotMode = settings.pivot ?? this.pivotMode;
      this._emit();
    });
  }

  dispose() {
    if (this.selectionConn) this.selectionConn.Disconnect();
    if (this.settingsConn) this.settingsConn.Disconnect?.();
    this._listeners.clear();
    this.dragState = null;
  }

  subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    this._listeners.add(listener);
    listener(this.getState());
    return () => {
      this._listeners.delete(listener);
    };
  }

  _emit() {
    const state = this.getState();
    for (const listener of this._listeners) {
      try {
        listener(state);
      } catch (err) {
        console.error('[Gizmos] Listener failed', err);
      }
    }
  }

  _resetDrag() {
    this.dragState = null;
    this.axis = null;
  }

  getState() {
    return {
      mode: this.mode,
      transformSpace: this.transformSpace,
      pivotMode: this.pivotMode,
      snap: { ...this.snap },
      hasSelection: this.targets.length > 0,
    };
  }

  getToolMode() {
    return this.mode;
  }

  setToolMode(mode) {
    const normalized = TOOL_MODES.includes(mode) ? mode : 'select';
    if (this.mode === normalized) return;
    this.mode = normalized;
    this._emit();
  }

  setTransformSpace(space) {
    const normalized = space === 'local' ? 'local' : 'global';
    if (this.transformSpace === normalized) return;
    this.transformSpace = normalized;
    this.selection?.setTransformSpace?.(normalized);
    this._emit();
  }

  setPivotMode(mode) {
    const normalized = mode === 'center' ? 'center' : 'pivot';
    if (this.pivotMode === normalized) return;
    this.pivotMode = normalized;
    this.selection?.setPivotMode?.(normalized);
    this._emit();
  }

  setSnapValue(type, value) {
    if (!Object.prototype.hasOwnProperty.call(this.snap, type)) return;
    const normalized = typeof value === 'number' && value > 0 ? value : null;
    if (this.snap[type] === normalized) return;
    this.snap[type] = normalized;
    this._emit();
  }

  toggleSnapValue(type, value) {
    if (!Object.prototype.hasOwnProperty.call(this.snap, type)) return;
    const normalized = typeof value === 'number' && value > 0 ? value : null;
    const next = this.snap[type] === normalized ? null : normalized;
    this.setSnapValue(type, next);
  }

  beginDrag(axis) {
    if (!axis || this.mode === 'select') return;
    this.axis = axis;
    const captured = new Map();
    for (const inst of this.targets) {
      captured.set(inst, {
        position: cloneVector(inst.Position),
        rotation: cloneVector(inst.Rotation),
        scale: cloneVector(inst.Scale),
      });
    }
    this.dragState = {
      axis,
      mode: this.mode,
      initial: captured,
    };
  }

  drag(offset) {
    if (!this.dragState) return;
    const { axis, mode, initial } = this.dragState;
    if (!axis || !mode) return;

    const applyTranslation = delta => {
      for (const inst of this.targets) {
        const start = initial.get(inst)?.position ?? cloneVector(inst.Position);
        const snappedDelta = snapDelta(delta, this.snap.translate);
        const updated = { ...start, [axis]: start[axis] + snappedDelta };
        inst.setProperty('Position', updated);
      }
    };

    const applyRotation = delta => {
      for (const inst of this.targets) {
        const start = initial.get(inst)?.rotation ?? cloneVector(inst.Rotation);
        const snappedDelta = snapDelta(delta, this.snap.rotate);
        const updated = { ...start, [axis]: start[axis] + snappedDelta };
        inst.setProperty('Rotation', updated);
      }
    };

    const applyScale = delta => {
      for (const inst of this.targets) {
        const start = initial.get(inst)?.scale ?? cloneVector(inst.Scale);
        const snappedDelta = snapDelta(delta, this.snap.scale);
        if (axis === 'uniform') {
          const next = {
            x: Math.max(0.001, start.x + snappedDelta),
            y: Math.max(0.001, start.y + snappedDelta),
            z: Math.max(0.001, start.z + snappedDelta),
          };
          inst.setProperty('Scale', next);
        } else {
          const updated = {
            ...start,
            [axis]: Math.max(0.001, start[axis] + snappedDelta),
          };
          inst.setProperty('Scale', updated);
        }
      }
    };

    if (mode === 'move') {
      applyTranslation(offset);
    } else if (mode === 'rotate') {
      applyRotation(offset);
    } else if (mode === 'scale') {
      applyScale(offset);
    }
  }

  endDrag() {
    if (!this.dragState) return;
    const commands = [];
    const { initial } = this.dragState;
    for (const inst of this.targets) {
      const before = initial.get(inst);
      if (!before) continue;
      const after = {
        position: cloneVector(inst.Position),
        rotation: cloneVector(inst.Rotation),
        scale: cloneVector(inst.Scale),
      };
      const command = createTransformCommand(inst, before, after);
      if (command) {
        commands.push(command);
      }
    }

    if (commands.length === 1) {
      this.undo.execute(commands[0]);
    } else if (commands.length > 1) {
      this.undo.execute({
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

    this._resetDrag();
  }
}
