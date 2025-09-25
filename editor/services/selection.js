import { Signal } from '../../engine/core/signal.js';

// Selection service shared by the editor. Tracks the current selection and
// notifies listeners through the Changed signal whenever the selection
// contents are updated.
class Selection {
  constructor() {
    this._selection = [];
    this._primary = null;
    this._transformSpace = 'global';
    this._pivotMode = 'pivot';
    this.Changed = new Signal();
    this.TransformSettingsChanged = new Signal();
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

  getTransformSpace() {
    return this._transformSpace;
  }

  setTransformSpace(space) {
    const next = space === 'local' ? 'local' : 'global';
    if (this._transformSpace === next) return;
    this._transformSpace = next;
    this.TransformSettingsChanged.Fire(this.getTransformSettings());
  }

  toggleTransformSpace() {
    this.setTransformSpace(this._transformSpace === 'global' ? 'local' : 'global');
  }

  getPivotMode() {
    return this._pivotMode;
  }

  setPivotMode(mode) {
    const next = mode === 'center' ? 'center' : 'pivot';
    if (this._pivotMode === next) return;
    this._pivotMode = next;
    this.TransformSettingsChanged.Fire(this.getTransformSettings());
  }

  togglePivotMode() {
    this.setPivotMode(this._pivotMode === 'pivot' ? 'center' : 'pivot');
  }

  getTransformSettings() {
    return { space: this._transformSpace, pivot: this._pivotMode };
  }

  getBounds() {
    if (!this._selection.length) {
      return null;
    }
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;

    const expand = inst => {
      if (!inst) return;
      const position = inst.Position ?? { x: 0, y: 0, z: 0 };
      const scale = inst.Scale ?? { x: 1, y: 1, z: 1 };
      const halfX = Math.abs(scale.x ?? 1) * 0.5;
      const halfY = Math.abs(scale.y ?? 1) * 0.5;
      const halfZ = Math.abs(scale.z ?? 1) * 0.5;
      const px = position.x ?? 0;
      const py = position.y ?? 0;
      const pz = position.z ?? 0;
      minX = Math.min(minX, px - halfX);
      minY = Math.min(minY, py - halfY);
      minZ = Math.min(minZ, pz - halfZ);
      maxX = Math.max(maxX, px + halfX);
      maxY = Math.max(maxY, py + halfY);
      maxZ = Math.max(maxZ, pz + halfZ);
    };

    this._selection.forEach(expand);

    if (minX === Infinity) {
      return null;
    }

    const center = {
      x: (minX + maxX) * 0.5,
      y: (minY + maxY) * 0.5,
      z: (minZ + maxZ) * 0.5,
    };
    const size = {
      x: Math.max(0, maxX - minX),
      y: Math.max(0, maxY - minY),
      z: Math.max(0, maxZ - minZ),
    };

    return {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ },
      center,
      size,
    };
  }

  getPivotPosition(mode = this._pivotMode) {
    if (!this._selection.length) {
      return { x: 0, y: 0, z: 0 };
    }
    if (mode === 'center') {
      const bounds = this.getBounds();
      if (bounds?.center) {
        return bounds.center;
      }
    }
    const primary = this.getPrimary();
    return primary?.Position ?? { x: 0, y: 0, z: 0 };
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
