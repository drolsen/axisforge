import test from 'ava';
import UDim from '../src/UDim.js';
import UDim2 from '../src/UDim2.js';

test('UDim math', t => {
  const a = new UDim(0.5, 10);
  const b = new UDim(0.25, 5);
  const c = UDim.add(a, b);
  t.is(c.scale, 0.75);
  t.is(c.offset, 15);
  t.is(a.toPixels(100), 60);
});

test('UDim2 math', t => {
  const a = new UDim2(0.5, 10, 0.25, 5);
  const b = new UDim2(0.25, -5, 0.5, 20);
  const c = UDim2.add(a, b);
  t.is(c.x.scale, 0.75);
  t.is(c.x.offset, 5);
  t.is(c.y.scale, 0.75);
  t.is(c.y.offset, 25);
  const pixels = c.toPixels(200, 100);
  t.deepEqual(pixels, { x: 0.75 * 200 + 5, y: 0.75 * 100 + 25 });
});
