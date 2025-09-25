// Simple undo/redo stack for editor actions.
export default class UndoService {
  constructor() {
    this.undoStack = [];
    this.redoStack = [];
  }

  // Execute a command and push it onto the undo stack.
  execute(cmd) {
    if (cmd && typeof cmd.redo === 'function') {
      cmd.redo();
      this.undoStack.push(cmd);
      this.redoStack.length = 0;
    }
  }

  undo() {
    const cmd = this.undoStack.pop();
    if (cmd && typeof cmd.undo === 'function') {
      cmd.undo();
      this.redoStack.push(cmd);
    }
  }

  redo() {
    const cmd = this.redoStack.pop();
    if (cmd && typeof cmd.redo === 'function') {
      cmd.redo();
      this.undoStack.push(cmd);
    }
  }

  // Command helpers
  createInstance(inst, parent) {
    return {
      undo() {
        inst.Parent = null;
      },
      redo() {
        inst.Parent = parent;
      },
    };
  }

  deleteInstance(inst) {
    const parent = inst.Parent;
    return {
      undo() {
        inst.Parent = parent;
      },
      redo() {
        inst.Parent = null;
      },
    };
  }

  reparent(inst, newParent) {
    const oldParent = inst.Parent;
    return {
      undo() {
        inst.Parent = oldParent;
      },
      redo() {
        inst.Parent = newParent;
      },
    };
  }

  setProperty(inst, prop, value) {
    const oldValue = inst[prop];
    return {
      undo() {
        inst.setProperty(prop, oldValue);
      },
      redo() {
        inst.setProperty(prop, value);
      },
    };
  }

  setAttribute(inst, attr, value) {
    const oldValue = inst.GetAttribute(attr);
    return {
      undo() {
        if (oldValue === undefined) inst.Attributes.delete(attr);
        else inst.SetAttribute(attr, oldValue);
      },
      redo() {
        inst.SetAttribute(attr, value);
      },
    };
  }

  removeAttribute(inst, attr) {
    const hadValue = inst.Attributes.has(attr);
    const oldValue = inst.GetAttribute(attr);
    return {
      undo() {
        if (hadValue) {
          inst.SetAttribute(attr, oldValue);
        } else if (inst.Attributes.has(attr)) {
          inst.Attributes.delete(attr);
          if (inst?.Changed?.Fire) inst.Changed.Fire(attr);
        } else if (inst?.Changed?.Fire) {
          inst.Changed.Fire(attr);
        }
      },
      redo() {
        if (inst.Attributes.delete(attr) && inst?.Changed?.Fire) {
          inst.Changed.Fire(attr);
        } else if (inst?.Changed?.Fire) {
          inst.Changed.Fire(attr);
        }
      },
    };
  }
}
