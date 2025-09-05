/**
 * Simple RGBA mask painting utilities.
 * A brush write updates all channels within a circular area.
 */

/**
 * Paint a circular brush into an RGBA mask texture.
 *
 * @param {Float32Array} mask   Target mask texture data.
 * @param {number} width        Texture width in texels.
 * @param {number} height       Texture height in texels.
 * @param {number} cx           Brush center X.
 * @param {number} cy           Brush center Y.
 * @param {number} radius       Brush radius in texels.
 * @param {number[]} color      Array of 4 values to write into the mask.
 */
export function paintBrush(mask, width, height, cx, cy, radius, color) {
  const r2 = radius * radius;
  const x0 = Math.max(0, Math.floor(cx - radius));
  const x1 = Math.min(width - 1, Math.ceil(cx + radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const y1 = Math.min(height - 1, Math.ceil(cy + radius));

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) {
        const idx = (y * width + x) * 4;
        for (let c = 0; c < 4; c++) {
          mask[idx + c] = color[c];
        }
      }
    }
  }
}
