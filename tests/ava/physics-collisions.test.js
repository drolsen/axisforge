import test from 'ava';
import { Instance, GetService } from '../../engine/core/index.js';

const PS = () => GetService('PhysicsService');

// Create collision groups and verify ids/collidability defaults

test('create collision groups maintain ids and defaults', t => {
  const physics = PS();
  const groupAId = physics.CreateCollisionGroup('TestGroupA');
  const groupBId = physics.CreateCollisionGroup('TestGroupB');

  t.true(Number.isInteger(groupAId));
  t.true(Number.isInteger(groupBId));
  t.not(groupAId, groupBId);
  t.is(physics.CreateCollisionGroup('TestGroupA'), groupAId);

  t.true(physics.CollisionGroupsAreCollidable('TestGroupA', 'TestGroupB'));
  t.true(physics.CollisionGroupsAreCollidable('TestGroupA', 'TestGroupA'));
  t.true(physics.CollisionGroupsAreCollidable('TestGroupB', 'TestGroupB'));
});

// Toggle collidability and ensure symmetry

test('collision group collidability toggle', t => {
  const physics = PS();
  physics.CreateCollisionGroup('ToggleGroupA');
  physics.CreateCollisionGroup('ToggleGroupB');

  physics.CollisionGroupSetCollidable('ToggleGroupA', 'ToggleGroupB', false);
  t.false(physics.CollisionGroupsAreCollidable('ToggleGroupA', 'ToggleGroupB'));
  t.false(physics.CollisionGroupsAreCollidable('ToggleGroupB', 'ToggleGroupA'));

  physics.CollisionGroupSetCollidable('ToggleGroupA', 'ToggleGroupB', true);
  t.true(physics.CollisionGroupsAreCollidable('ToggleGroupA', 'ToggleGroupB'));
});

// CollisionGroupContainsPart uses attribute or property as placeholder membership

test('collision group contains part via attribute or property', t => {
  const physics = PS();
  physics.CreateCollisionGroup('PartsGroup');

  const part = new Instance('Part');
  t.false(physics.CollisionGroupContainsPart('PartsGroup', part));

  part.SetAttribute('CollisionGroup', 'PartsGroup');
  t.true(physics.CollisionGroupContainsPart('PartsGroup', part));

  part.SetAttribute('CollisionGroup', 'OtherGroup');
  t.false(physics.CollisionGroupContainsPart('PartsGroup', part));

  part.CollisionGroup = 'PartsGroup';
  t.true(physics.CollisionGroupContainsPart('PartsGroup', part));
});
