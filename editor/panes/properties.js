import UndoService from '../services/undo.js';

// Minimal properties pane. Editing a numeric property pushes an undo entry.
export default class Properties {
  constructor(undo = new UndoService()) {
    this.undo = undo;
  }

  editNumber(inst, prop, value) {
    const num = Number(value);
    if (Number.isNaN(num)) return;
    this.undo.execute(this.undo.setProperty(inst, prop, num));
  }
}
