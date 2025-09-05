import test from 'ava';
import { srgbToLinear, linearToSrgb, tonemapACES } from '../src/Color.js';

test('srgb to linear and back', t => {
  const c = [0.25, 0.5, 0.75];
  const l = srgbToLinear(c);
  const s = linearToSrgb(l);
  for (let i = 0; i < 3; i++) {
    t.true(Math.abs(s[i] - c[i]) < 1e-6);
  }
});

test('aces tonemap clamps values', t => {
  const c = [4, 2, 1];
  const tm = tonemapACES(c);
  tm.forEach(v => {
    t.true(v >= 0 && v <= 1);
  });
});
