class PhysicsAdapter {
  constructor() {
    this._groupsByName = new Map();
    this._groupsById = new Map();
    this._nextGroupId = 0;
    this._collidability = new Map(); // id -> Map<id, boolean>
  }

  _getOrCreateCollidabilityRow(groupId) {
    if (!this._collidability.has(groupId)) {
      this._collidability.set(groupId, new Map());
    }
    return this._collidability.get(groupId);
  }

  createCollisionGroup(name) {
    if (this._groupsByName.has(name)) {
      return this._groupsByName.get(name).id;
    }

    const id = this._nextGroupId++;
    const group = { id, name };
    this._groupsByName.set(name, group);
    this._groupsById.set(id, group);

    // Ensure new group collides with all existing groups by default (including itself)
    for (const [, other] of this._groupsByName) {
      const row = this._getOrCreateCollidabilityRow(group.id);
      const otherRow = this._getOrCreateCollidabilityRow(other.id);
      row.set(other.id, true);
      otherRow.set(group.id, true);
    }

    return id;
  }

  getCollisionGroup(name) {
    return this._groupsByName.get(name) || null;
  }

  collisionGroupsCanCollide(nameA, nameB) {
    const groupA = this.getCollisionGroup(nameA);
    const groupB = this.getCollisionGroup(nameB);
    if (!groupA || !groupB) {
      return true;
    }
    const row = this._collidability.get(groupA.id);
    if (!row) {
      return true;
    }
    const value = row.get(groupB.id);
    return value !== undefined ? value : true;
  }

  setCollisionGroupsCollidable(nameA, nameB, canCollide) {
    const groupA = this.getCollisionGroup(nameA);
    const groupB = this.getCollisionGroup(nameB);
    if (!groupA || !groupB) {
      return;
    }
    const rowA = this._getOrCreateCollidabilityRow(groupA.id);
    const rowB = this._getOrCreateCollidabilityRow(groupB.id);
    rowA.set(groupB.id, !!canCollide);
    rowB.set(groupA.id, !!canCollide);
  }

  collisionGroupContainsInstance(groupName, instance) {
    if (!instance) return false;
    if (typeof instance.GetAttribute === 'function') {
      const attr = instance.GetAttribute('CollisionGroup');
      if (attr === groupName) {
        return true;
      }
    }
    if (instance.CollisionGroup === groupName) {
      return true;
    }
    return false;
  }
}

export default PhysicsAdapter;
