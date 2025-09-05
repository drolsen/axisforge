export default class ShadowsVSM {
  /**
   * @param {object} [params]
   * @param {number} [params.softness=1] Blur radius in texels.
   * @param {number} [params.bias=0.0] Depth bias applied when sampling.
   */
  constructor({ softness = 1, bias = 0.0 } = {}) {
    this.softness = softness;
    this.bias = bias;
  }

  /**
   * Convert a depth map into first and second moments.
   * @param {number[][]} depth 2D array of depth values.
   * @returns {{ m1:number[][], m2:number[][] }}
   */
  momentsFromDepth(depth) {
    const size = depth.length;
    const m1 = Array.from({ length: size }, () => Array(size));
    const m2 = Array.from({ length: size }, () => Array(size));
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d = depth[y][x];
        m1[y][x] = d;
        m2[y][x] = d * d;
      }
    }
    return { m1, m2 };
  }

  /**
   * Apply separable box blur to the moment map.
   * @param {{ m1:number[][], m2:number[][] }} moments
   * @returns {{ m1:number[][], m2:number[][] }}
   */
  blurMoments(moments) {
    const size = moments.m1.length;
    const r = this.softness;
    if (r <= 0) return moments;

    const temp1 = Array.from({ length: size }, () => Array(size).fill(0));
    const temp2 = Array.from({ length: size }, () => Array(size).fill(0));
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let sum1 = 0,
          sum2 = 0,
          count = 0;
        for (let i = -r; i <= r; i++) {
          const xx = x + i;
          if (xx >= 0 && xx < size) {
            sum1 += moments.m1[y][xx];
            sum2 += moments.m2[y][xx];
            count++;
          }
        }
        temp1[y][x] = sum1 / count;
        temp2[y][x] = sum2 / count;
      }
    }

    const out1 = Array.from({ length: size }, () => Array(size).fill(0));
    const out2 = Array.from({ length: size }, () => Array(size).fill(0));
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let sum1 = 0,
          sum2 = 0,
          count = 0;
        for (let i = -r; i <= r; i++) {
          const yy = y + i;
          if (yy >= 0 && yy < size) {
            sum1 += temp1[yy][x];
            sum2 += temp2[yy][x];
            count++;
          }
        }
        out1[y][x] = sum1 / count;
        out2[y][x] = sum2 / count;
      }
    }
    return { m1: out1, m2: out2 };
  }

  /**
   * Compute shadow factor for each receiver depth using blurred moments.
   * @param {number[][]} receiverDepth Receiver depth values.
   * @param {{ m1:number[][], m2:number[][] }} moments Blurred moments from light pass.
   * @param {number} [bias=this.bias] Depth bias.
   * @returns {number[][]} Shadow factor (0..1) per pixel.
   */
  shadowFactor(receiverDepth, moments, bias = this.bias) {
    const size = receiverDepth.length;
    const out = Array.from({ length: size }, () => Array(size).fill(0));
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d = receiverDepth[y][x];
        const mean = moments.m1[y][x];
        const m2 = moments.m2[y][x];
        const variance = Math.max(m2 - mean * mean, 0);
        const t = d - bias;
        if (t <= mean) {
          out[y][x] = 1;
        } else {
          const denom = variance + (t - mean) * (t - mean);
          out[y][x] = denom > 0 ? Math.min(Math.max(variance / denom, 0), 1) : 0;
        }
      }
    }
    return out;
  }
}
