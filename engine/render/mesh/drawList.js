class MeshDrawList {
  constructor() {
    this.instances = new Set();
    this._cache = [];
    this._dirty = true;
  }

  register(instance) {
    if (!instance) {
      return;
    }
    this.instances.add(instance);
    this._dirty = true;
  }

  unregister(instance) {
    if (!instance) {
      return;
    }
    if (this.instances.delete(instance)) {
      this._dirty = true;
    }
  }

  markDirty() {
    this._dirty = true;
  }

  _refresh() {
    if (!this._dirty) {
      return;
    }
    this._cache = [];
    for (const inst of this.instances) {
      if (typeof inst.isRenderable === 'function') {
        if (!inst.isRenderable()) {
          continue;
        }
      }
      this._cache.push(inst);
    }
    this._dirty = false;
  }

  getInstances() {
    this._refresh();
    return this._cache;
  }
}

const drawList = new MeshDrawList();

export default drawList;
