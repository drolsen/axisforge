import test from 'ava';
import { paintBrush } from '../src/PaintBrush.js';

test('brush stroke updates mask texture', t => {
  const width = 4;
  const height = 4;
  const mask = new Float32Array(width * height * 4).fill(0);
  paintBrush(mask, width, height, 1, 1, 1, [0, 0, 1, 0]);
  const idx = (1 * width + 1) * 4;
  t.is(mask[idx + 2], 1);
  t.is(mask[idx], 0);
  const outside = (0 * width + 0) * 4;
  t.is(mask[outside + 2], 0);
});
