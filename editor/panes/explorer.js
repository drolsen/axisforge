import { Instance } from '../../engine/core/index.js';
import UndoService from '../services/undo.js';
import { Selection } from '../services/selection.js';

// Minimal Explorer pane logic providing creation and deletion actions
// hooked into the undo service.
export default class Explorer {
  constructor(undo = new UndoService(), selection = new Selection()) {
    this.undo = undo;
    this.selection = selection;
    this.nodes = new Set();
  }

  register(inst) {
    if (inst) this.nodes.add(inst);
  }

  unregister(inst) {
    if (!inst) return;
    this.nodes.delete(inst);
    if (this.selection.isSelected(inst)) {
      this.selection.remove(inst);
    }
  }

  click(inst, { additive = false, toggle = false } = {}) {
    if (!inst) {
      this.selection.clear();
      return this.selection.get();
    }

    this.register(inst);

    if (toggle && this.selection.isSelected(inst)) {
      this.selection.remove(inst);
      return this.selection.get();
    }

    if (additive) {
      this.selection.add(inst);
    } else {
      this.selection.set([inst]);
    }

    return this.selection.get();
  }

  isSelected(inst) {
    return this.selection.isSelected(inst);
  }

  addModel() {
    const model = new Instance('Model');
    this.undo.execute(this.undo.createInstance(model, null));
    return model;
  }

  deleteSelected() {
    for (const inst of this.selection.getSelection()) {
      this.undo.execute(this.undo.deleteInstance(inst));
    }
    this.selection.clear();
  }
}
