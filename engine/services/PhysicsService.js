import PhysicsAdapter from '../physics/adapter.js';

export default class PhysicsService {
  constructor(adapter = new PhysicsAdapter()) {
    this._adapter = adapter;
    this.CreateCollisionGroup = name => {
      return this._adapter.createCollisionGroup(name);
    };

    this.CollisionGroupsAreCollidable = (groupA, groupB) => {
      return this._adapter.collisionGroupsCanCollide(groupA, groupB);
    };

    this.CollisionGroupSetCollidable = (groupA, groupB, canCollide) => {
      this._adapter.setCollisionGroupsCollidable(groupA, groupB, canCollide);
    };

    this.CollisionGroupContainsPart = (group, instance) => {
      return this._adapter.collisionGroupContainsInstance(group, instance);
    };
  }
}
