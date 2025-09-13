import test from 'ava';
import { Instance } from '../../engine/core/index.js';

// ChildAdded/Removed order
// Reparent child from A to B and check event order

test('ChildAdded/Removed order on reparent', t => {
  const a = new Instance('A');
  const b = new Instance('B');
  const child = new Instance('Child');
  child.Parent = a;
  const events = [];
  a.ChildRemoved.Connect(() => events.push('removed'));
  b.ChildAdded.Connect(() => events.push('added'));
  child.Parent = b;
  t.deepEqual(events, ['removed', 'added']);
});

// AncestryChanged triggers on reparent

test('AncestryChanged triggers', t => {
  const a = new Instance('A');
  const child = new Instance('Child');
  let fired = false;
  child.AncestryChanged.Connect(() => { fired = true; });
  child.Parent = a;
  t.true(fired);
});

// Changed fires when property mutates

test('Changed fires on property set', t => {
  const inst = new Instance('Thing');
  let changed = '';
  inst.Changed.Connect(prop => { changed = prop; });
  inst.setProperty('Name', 'Other');
  t.is(changed, 'Name');
});

// Attributes roundtrip

test('Attributes set/get roundtrip', t => {
  const inst = new Instance('Thing');
  inst.SetAttribute('Health', 100);
  t.is(inst.GetAttribute('Health'), 100);
  t.deepEqual(inst.GetAttributes(), { Health: 100 });
});
