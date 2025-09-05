import test from 'ava';
import { UDim } from '../src/UDim.js';
import { UDim2 } from '../src/UDim2.js';

test('UDim arithmetic and resolve', t => {
  const u1 = new UDim(0.5, 10);
  const u2 = new UDim(0.25, 5);
  const u3 = u1.add(u2);
  t.is(u3.scale, 0.75);
  t.is(u3.offset, 15);
  t.is(u3.resolve(100), 90);
});

test('UDim2 arithmetic and resolve', t => {
  const u1 = new UDim2(0.5, 10, 0.5, 20);
  const u2 = new UDim2(0.25, 5, 0.25, 5);
  const u3 = u1.add(u2);
  t.is(u3.x.scale, 0.75);
  t.is(u3.y.offset, 25);
  const resolved = u3.resolve(200, 100);
  t.deepEqual(resolved, { x: 0.75 * 200 + 15, y: 0.75 * 100 + 25 });
});
