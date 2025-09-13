import test from 'ava';
import { Instance, GetService } from '../../engine/core/index.js';

const CS = () => GetService('CollectionService');

// Add/remove tags; query correctness

test('add/remove tags and query', t => {
  const cs = CS();
  const inst = new Instance('Thing');
  cs.AddTag(inst, 'Tag');
  t.true(cs.HasTag(inst, 'Tag'));
  t.deepEqual(cs.GetTags(inst), ['Tag']);
  t.deepEqual(cs.GetTagged('Tag'), [inst]);
  cs.RemoveTag(inst, 'Tag');
  t.false(cs.HasTag(inst, 'Tag'));
  t.deepEqual(cs.GetTags(inst), []);
  t.deepEqual(cs.GetTagged('Tag'), []);
});

// Signals fire on add/remove

test('signals fire on add/remove', t => {
  const cs = CS();
  const inst = new Instance('Part');
  let added = false;
  let removed = false;
  cs.GetInstanceAddedSignal('A').Once(i => {
    if (i === inst) added = true;
  });
  cs.GetInstanceRemovedSignal('A').Once(i => {
    if (i === inst) removed = true;
  });
  cs.AddTag(inst, 'A');
  cs.RemoveTag(inst, 'A');
  t.true(added);
  t.true(removed);
});

// Instances removed -> no stale refs

test('instances removed cleanup tags', t => {
  const cs = CS();
  const parent = new Instance('Parent');
  const child = new Instance('Child');
  child.Parent = parent;
  let removed = false;
  cs.GetInstanceRemovedSignal('Gone').Once(i => {
    if (i === child) removed = true;
  });
  cs.AddTag(child, 'Gone');
  child.Remove();
  t.true(removed);
  t.deepEqual(cs.GetTagged('Gone'), []);
  t.false(cs.HasTag(child, 'Gone'));
});
