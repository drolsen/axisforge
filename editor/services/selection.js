import { Signal } from '../../engine/core/signal.js';

// Basic selection service used by the editor. Keeps a list of selected
// Instances and emits a signal when the selection changes.
export default class SelectionService {
  constructor() {
    this.selection = [];
    this.SelectionChanged = new Signal();
  }

  getSelection() {
    return [...this.selection];
  }

  setSelection(items) {
    this.selection = [...items];
    this.SelectionChanged.Fire(this.getSelection());
  }

  clear() {
    this.setSelection([]);
  }

  add(item) {
    if (!this.selection.includes(item)) {
      this.selection.push(item);
      this.SelectionChanged.Fire(this.getSelection());
    }
  }

  remove(item) {
    const idx = this.selection.indexOf(item);
    if (idx !== -1) {
      this.selection.splice(idx, 1);
      this.SelectionChanged.Fire(this.getSelection());
    }
  }
}
