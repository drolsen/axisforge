/**
 * Simple variance shadow mapping utilities for a single directional light.
 *
 * Depth map -> moment map -> separable blur -> shadow factor.
 */

// Convert a depth buffer (Float32Array) into a moment map with two moments
// stored per texel (m1, m2).
export function createMomentMap(depth, width, height) {
  const moments = new Float32Array(width * height * 2);
  for (let i = 0; i < width * height; i++) {
    const z = depth[i];
    moments[2 * i] = z;
    moments[2 * i + 1] = z * z;
  }
  return moments;
}

// Apply a simple separable box blur to the moment map. `radius` defines the
// number of pixels to sample on each side. The blur is done in-place.
export function blurMomentMap(moments, width, height, radius = 0) {
  if (radius <= 0) return moments;

  const temp = new Float32Array(moments.length);
  const channels = 2;
  const scale = 1 / (radius * 2 + 1);

  // Horizontal pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let m1 = 0;
      let m2 = 0;
      for (let k = -radius; k <= radius; k++) {
        const ix = Math.min(width - 1, Math.max(0, x + k));
        const idx = channels * (y * width + ix);
        m1 += moments[idx];
        m2 += moments[idx + 1];
      }
      const o = channels * (y * width + x);
      temp[o] = m1 * scale;
      temp[o + 1] = m2 * scale;
    }
  }

  // Vertical pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let m1 = 0;
      let m2 = 0;
      for (let k = -radius; k <= radius; k++) {
        const iy = Math.min(height - 1, Math.max(0, y + k));
        const idx = channels * (iy * width + x);
        m1 += temp[idx];
        m2 += temp[idx + 1];
      }
      const o = channels * (y * width + x);
      moments[o] = m1 * scale;
      moments[o + 1] = m2 * scale;
    }
  }

  return moments;
}

// Compute the shadow factor for a given receiver depth using the supplied
// moments. `bias` helps prevent light bleeding and should be a small positive
// number (e.g. 0.001).
export function computeShadowFactor(depth, m1, m2, bias = 0) {
  const variance = Math.max(m2 - m1 * m1, 1e-6);
  const d = depth - m1 - bias;
  const p = variance / (variance + d * d);
  return Math.min(Math.max(p, 0), 1);
}

export default {
  createMomentMap,
  blurMomentMap,
  computeShadowFactor
};
