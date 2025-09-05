/**
 * Utilities for terrain texture splatting based on height and slope rules.
 * The CPU precompute step evaluates which rule applies per texel and
 * prepares both the mask texture data and a packed parameter buffer for use
 * on the GPU.
 */

/**
 * @typedef {Object} SplatRule
 * @property {number} minHeight - Minimum inclusive height for the rule.
 * @property {number} maxHeight - Maximum inclusive height for the rule.
 * @property {number} minSlope - Minimum inclusive slope for the rule (0..1).
 * @property {number} maxSlope - Maximum inclusive slope for the rule (0..1).
 * @property {number} layer - Output layer index (0-3 for RGBA masks).
 */

/**
 * Precompute splat rule results for a height/slope field.
 *
 * @param {Float32Array} heights  Height per texel.
 * @param {Float32Array} slopes   Slope per texel in range [0,1].
 * @param {number} width          Width of the field in texels.
 * @param {number} height         Height of the field in texels.
 * @param {SplatRule[]} rules     Array of splat rules.
 * @returns {{ params: Float32Array, masks: Float32Array }}
 *          params - Packed GPU parameters [hMin,hMax,sMin,sMax,...].
 *          masks  - RGBA mask texture data.
 */
export function precomputeSplat(heights, slopes, width, height, rules) {
  if (heights.length !== slopes.length) {
    throw new Error('Height and slope arrays must be the same length');
  }
  if (heights.length !== width * height) {
    throw new Error('Height array length does not match dimensions');
  }

  // Pack rule parameters for GPU consumption.
  const params = new Float32Array(rules.length * 4);
  for (let i = 0; i < rules.length; i++) {
    const r = rules[i];
    params[i * 4 + 0] = r.minHeight;
    params[i * 4 + 1] = r.maxHeight;
    params[i * 4 + 2] = r.minSlope;
    params[i * 4 + 3] = r.maxSlope;
  }

  // Generate mask texture data (RGBA per texel).
  const masks = new Float32Array(width * height * 4);
  for (let i = 0; i < heights.length; i++) {
    const h = heights[i];
    const s = slopes[i];
    for (let j = 0; j < rules.length; j++) {
      const r = rules[j];
      if (
        h >= r.minHeight &&
        h <= r.maxHeight &&
        s >= r.minSlope &&
        s <= r.maxSlope
      ) {
        const channel = r.layer & 3; // clamp to 0..3
        masks[i * 4 + channel] = 1;
        break; // first matching rule wins
      }
    }
  }

  return { params, masks };
}
