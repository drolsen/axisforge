import test from 'ava';
import { createMomentMap, blurMomentMap, computeShadowFactor } from '../src/Lighting/ShadowsVSM.js';

// Simple scenario demonstrating that blurring softens the shadow edge.
// The depth map contains a step at the midpoint: left side at 1.0, right at 0.5.
// A plane at depth 0.75 samples this shadow map.

function setup() {
  const depth = new Float32Array([1, 1, 0.5, 0.5]);
  const moments = createMomentMap(depth, 4, 1);
  const planeDepth = 0.75;
  return { moments, planeDepth };
}

test('blur increases light in penumbra', t => {
  const { moments, planeDepth } = setup();
  // Sample at the first pixel right of the edge (index 2)
  let m1 = moments[2 * 2];
  let m2 = moments[2 * 2 + 1];
  const hard = computeShadowFactor(planeDepth, m1, m2, 0);
  t.true(hard < 0.1);

  blurMomentMap(moments, 4, 1, 1);
  m1 = moments[2 * 2];
  m2 = moments[2 * 2 + 1];
  const soft = computeShadowFactor(planeDepth, m1, m2, 0);
  t.true(soft > hard);
});
