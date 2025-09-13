import test from 'ava';
import { Instance, GetService } from '../../engine/core/index.js';

test('GetService returns singletons', t => {
  const a = GetService('Lighting');
  const b = GetService('Lighting');
  t.is(a, b);
});

test('instances parent and child correctly', t => {
  const parent = new Instance('Parent');
  const child = new Instance('Child');
  parent.Add(child);
  t.is(child.Parent, parent);
  t.true(parent.Children.includes(child));
});
