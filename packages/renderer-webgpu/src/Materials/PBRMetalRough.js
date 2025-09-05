import { computeShadowFactor } from '../Lighting/ShadowsVSM.js';

/**
 * Extremely small stand-in for a PBR material used in tests. It exposes shadow
 * bias and softness parameters which are consumed by the shadowing utilities.
 */
export class PBRMetalRough {
  constructor({ color = [1, 1, 1], shadowBias = 0, shadowSoftness = 0 } = {}) {
    this.color = color;
    this.shadowBias = shadowBias;
    this.shadowSoftness = shadowSoftness; // currently used as blur radius
  }

  /**
     * Shade a pixel given its depth and the pre-filtered moment map.
     * `moments` is a Float32Array containing (m1, m2) pairs.
     */
  shade(index, depth, moments) {
    const m1 = moments[2 * index];
    const m2 = moments[2 * index + 1];
    const shadow = computeShadowFactor(depth, m1, m2, this.shadowBias);
    return this.color.map((c) => c * shadow);
  }
}

export default PBRMetalRough;
