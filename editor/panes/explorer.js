import { Instance } from '../../engine/core/index.js';
import UndoService from '../services/undo.js';
import SelectionService from '../services/selection.js';

// Minimal Explorer pane logic providing creation and deletion actions
// hooked into the undo service.
export default class Explorer {
  constructor(undo = new UndoService(), selection = new SelectionService()) {
    this.undo = undo;
    this.selection = selection;
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
