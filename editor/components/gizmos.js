import UndoService from '../services/undo.js';
import { Selection } from '../services/selection.js';

function cloneVector(value = {}) {
  return {
    x: typeof value.x === 'number' ? value.x : 0,
    y: typeof value.y === 'number' ? value.y : 0,
    z: typeof value.z === 'number' ? value.z : 0,
  };
}

function vectorsEqual(a, b) {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}

function createCommand(inst, before, after) {
  const prev = { ...before };
  const next = { ...after };
  return {
    undo: () => inst.setProperty('Position', { ...prev }),
    redo: () => inst.setProperty('Position', { ...next }),
  };
}

export default class TranslationGizmo {
  constructor(selection = new Selection(), undo = new UndoService()) {
    this.selection = selection;
    this.undo = undo;
    this.axis = null;
    this.original = new Map();
    this.targets = [];

    this.selectionConn = this.selection.Changed.Connect(sel => {
      this.targets = [...sel];
      this.original.clear();
      this.axis = null;
    });

    this.targets = this.selection.get();
  }

  dispose() {
    if (this.selectionConn) this.selectionConn.Disconnect();
    this.original.clear();
  }

  beginDrag(axis) {
    if (!axis) return;
    this.axis = axis;
    this.original.clear();
    for (const inst of this.targets) {
      this.original.set(inst, cloneVector(inst.Position));
    }
  }

  drag(offset) {
    if (!this.axis) return;
    for (const inst of this.targets) {
      const start = this.original.get(inst) || cloneVector(inst.Position);
      const updated = { ...start, [this.axis]: start[this.axis] + offset };
      inst.setProperty('Position', updated);
    }
  }

  endDrag() {
    if (!this.axis) return;
    const commands = [];
    for (const inst of this.targets) {
      const before = this.original.get(inst) || cloneVector(inst.Position);
      const after = cloneVector(inst.Position);
      if (!vectorsEqual(before, after)) {
        commands.push(createCommand(inst, before, after));
      }
    }

    if (commands.length === 1) {
      this.undo.execute(commands[0]);
    } else if (commands.length > 1) {
      this.undo.execute({
        undo: () => {
          for (const cmd of [...commands].reverse()) cmd.undo();
        },
        redo: () => {
          for (const cmd of commands) cmd.redo();
        },
      });
    }

    this.axis = null;
    this.original.clear();
  }
}
