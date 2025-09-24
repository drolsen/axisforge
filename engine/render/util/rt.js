export function safeSize(device, w, h, dprCap = 3) {
  const max2D = device?.limits?.maxTextureDimension2D || 8192;
  const clampedW = Math.min(Math.max(1, Math.floor(w)), max2D);
  const clampedH = Math.min(Math.max(1, Math.floor(h)), max2D);
  return [clampedW, clampedH];
}

export function recreateTex(device, desc, prev) {
  if (prev?.texture) {
    try {
      prev.texture.destroy?.();
    } catch {
      // ignore
    }
  }
  const texture = device.createTexture(desc);
  const view = texture.createView();
  return { texture, view, desc };
}
