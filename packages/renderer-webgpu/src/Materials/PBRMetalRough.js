export function srgbToLinear(color) {
  const convert = (v) =>
    v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  if (Array.isArray(color)) {
    return color.map(convert);
  }
  return convert(color);
}

export function linearToSrgb(color) {
  const convert = (v) =>
    v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  if (Array.isArray(color)) {
    return color.map(convert);
  }
  return convert(color);
}

export function tonemapACES(color) {
  const a = 2.51;
  const b = 0.03;
  const c = 2.43;
  const d = 0.59;
  const e = 0.14;
  const convert = (v) => {
    const num = v * (a * v + b);
    const denom = v * (c * v + d) + e;
    return Math.min(Math.max(num / denom, 0), 1);
  };
  if (Array.isArray(color)) {
    return color.map(convert);
  }
  return convert(color);
}

export class PBRMetalRough {
  constructor({
    baseColor = [1, 1, 1, 1],
    metallic = 1,
    roughness = 1,
    normal = null,
    occlusion = null,
    emissive = [0, 0, 0],
  } = {}) {
    this.baseColor = baseColor;
    this.metallic = metallic;
    this.roughness = roughness;
    this.normal = normal;
    this.occlusion = occlusion;
    this.emissive = emissive;

    // Param block for uniform buffer
    this.paramBuffer = new Float32Array(12);
    this._updateParams();
  }

  _updateParams() {
    const p = this.paramBuffer;
    p.set(this.baseColor, 0); // rgba
    p[4] = this.metallic;
    p[5] = this.roughness;
    p.set(this.emissive, 6);
  }

  get params() {
    this._updateParams();
    return this.paramBuffer;
  }
}

export default PBRMetalRough;

