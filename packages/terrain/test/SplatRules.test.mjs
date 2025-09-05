import test from 'ava';
import { precomputeSplat } from '../src/SplatRules.js';

// Visual verification of rule based splatting using simple height/slope data
// The resulting mask channels indicate which texture layer is selected

const width = 2;
const height = 2;
const heights = new Float32Array([
  0, 10,
  5, 15
]);
const slopes = new Float32Array([
  0.1, 0.2,
  0.8, 0.7
]);

const rules = [
  { minHeight: 0, maxHeight: 5, minSlope: 0, maxSlope: 0.5, layer: 0 }, // grass
  { minHeight: 0, maxHeight: 20, minSlope: 0.5, maxSlope: 1, layer: 1 }, // rock
  { minHeight: 5, maxHeight: 20, minSlope: 0, maxSlope: 0.5, layer: 2 }  // snow
];

test('precompute generates gpu params', t => {
  const { params } = precomputeSplat(heights, slopes, width, height, rules);
  t.deepEqual([...params], [0, 5, 0, 0.5, 0, 20, 0.5, 1, 5, 20, 0, 0.5]);
});

test('mask assigns layers based on rules', t => {
  const { masks } = precomputeSplat(heights, slopes, width, height, rules);
  const px = i => [...masks.slice(i * 4, i * 4 + 4)];
  t.deepEqual(px(0), [1, 0, 0, 0]);
  t.deepEqual(px(1), [0, 0, 1, 0]);
  t.deepEqual(px(2), [0, 1, 0, 0]);
  t.deepEqual(px(3), [0, 1, 0, 0]);
});
