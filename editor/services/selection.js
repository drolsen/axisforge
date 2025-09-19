import { Signal } from '../../engine/core/signal.js';

// Selection service shared by the editor. Tracks the current selection and
// notifies listeners through the Changed signal whenever the selection
// contents are updated.
class Selection {
  constructor() {
    this._selection = [];
    this._primary = null;
    this.Changed = new Signal();
  }

  /**
   * Retrieve a shallow copy of the selected instances.
   */
  get() {
    return [...this._selection];
  }

  // Backwards compatible alias with earlier prompt tasks.
  getSelection() {
    return this.get();
  }

  getPrimary() {
    return this._primary;
  }

  set(items) {
    const newList = [];
    const seen = new Set();
    for (const item of items) {
      if (!item || seen.has(item)) continue;
      seen.add(item);
      newList.push(item);
    }

    if (this._isSame(newList)) return;

    this._selection = newList;
    this._primary = newList.length ? newList[0] : null;
    this.Changed.Fire(this.get());
  }

  // Backwards compatible alias with earlier prompt tasks.
  setSelection(items) {
    this.set(items);
  }

  clear() {
    this.set([]);
  }

  add(item) {
    if (!item) return;
    if (this._selection.includes(item)) return;
    this.set([...this._selection, item]);
  }

  remove(item) {
    if (!item) return;
    if (!this._selection.includes(item)) return;
    this.set(this._selection.filter(i => i !== item));
  }

  isSelected(item) {
    return this._selection.includes(item);
  }

  _isSame(other) {
    if (other.length !== this._selection.length) return false;
    for (let i = 0; i < other.length; i += 1) {
      if (other[i] !== this._selection[i]) return false;
    }
    return true;
  }
}

export { Selection };
export default Selection;
