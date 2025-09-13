import test from 'ava';
import { Instance } from '../../engine/core/index.js';
import { serialize } from '../../engine/scene/serialize.js';
import { deserialize } from '../../engine/scene/deserialize.js';

// Ensure scene graphs roundtrip through JSON serialization.
test('scene serialize/deserialize roundtrip', t => {
  const root = new Instance('Model');
  root.Name = 'Root';
  const child = new Instance('Part');
  child.Name = 'Child';
  child.setProperty('Value', 10);
  child.SetAttribute('Color', 'red');
  root.Add(child);

  const json = serialize(root);
  const clone = deserialize(json);

  t.truthy(clone.guid);
  t.is(clone.Name, 'Root');
  t.is(clone.Children.length, 1);
  const newChild = clone.Children[0];
  t.is(newChild.Name, 'Child');
  t.is(newChild.Value, 10);
  t.is(newChild.GetAttribute('Color'), 'red');
  t.is(newChild.Parent, clone);
});
