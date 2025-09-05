import test from 'ava';
import {
  srgbToLinear,
  linearToSrgb,
  tonemapACES,
} from '../src/Materials/PBRMetalRough.js';

test('sRGB to linear and back', t => {
  const src = [0, 0.5, 1];
  const linear = srgbToLinear(src);
  const round = linearToSrgb(linear);
  for (let i = 0; i < src.length; i++) {
    t.true(Math.abs(src[i] - round[i]) < 1e-6);
  }
});

test('ACES tonemap clamps HDR values', t => {
  const color = [2, 4, 8];
  const mapped = tonemapACES(color);
  mapped.forEach(v => t.true(v >= 0 && v <= 1));
});
