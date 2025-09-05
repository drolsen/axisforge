export function srgbToLinear(color) {
  return color.map(c =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
}

export function linearToSrgb(color) {
  return color.map(c =>
    c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
  );
}

export function tonemapACES(color) {
  const a = 2.51;
  const b = 0.03;
  const c = 2.43;
  const d = 0.59;
  const e = 0.14;
  return color.map(x => {
    const v = (x * (a * x + b)) / (x * (c * x + d) + e);
    return Math.min(Math.max(v, 0), 1);
  });
}
