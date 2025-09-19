const DEFAULT_COLOR = [1, 1, 1, 1];
const DEFAULT_ROUGHNESS = 1.0;
const DEFAULT_METALNESS = 0.0;

function toVec4Color(input) {
  if (!input) {
    return new Float32Array(DEFAULT_COLOR);
  }

  const arr = Array.from(input);
  if (arr.length === 3) {
    arr.push(1.0);
  }
  if (arr.length !== 4) {
    throw new Error('Color values must have 3 or 4 components.');
  }
  return new Float32Array(arr);
}

export class StandardPBRMaterial {
  constructor(params = {}) {
    this.type = 'StandardPBR';
    this.color = toVec4Color(params.color);
    this.roughness = params.roughness ?? DEFAULT_ROUGHNESS;
    this.metalness = params.metalness ?? DEFAULT_METALNESS;

    this.maps = {
      albedo: { texture: null, sampler: null },
      normal: { texture: null, sampler: null },
      orm: { texture: null, sampler: null }
    };

    this.update(params);
  }

  update(params = {}) {
    if (Object.prototype.hasOwnProperty.call(params, 'color')) {
      this.color = toVec4Color(params.color);
    }
    if (Object.prototype.hasOwnProperty.call(params, 'roughness') && typeof params.roughness === 'number') {
      this.roughness = params.roughness;
    }
    if (Object.prototype.hasOwnProperty.call(params, 'metalness') && typeof params.metalness === 'number') {
      this.metalness = params.metalness;
    }

    if (Object.prototype.hasOwnProperty.call(params, 'albedoTexture')) {
      this.maps.albedo.texture = params.albedoTexture;
    }
    if (Object.prototype.hasOwnProperty.call(params, 'albedoSampler')) {
      this.maps.albedo.sampler = params.albedoSampler;
    }
    if (Object.prototype.hasOwnProperty.call(params, 'normalTexture')) {
      this.maps.normal.texture = params.normalTexture;
    }
    if (Object.prototype.hasOwnProperty.call(params, 'normalSampler')) {
      this.maps.normal.sampler = params.normalSampler;
    }
    if (Object.prototype.hasOwnProperty.call(params, 'ormTexture')) {
      this.maps.orm.texture = params.ormTexture;
    }
    if (Object.prototype.hasOwnProperty.call(params, 'ormSampler')) {
      this.maps.orm.sampler = params.ormSampler;
    }
  }

  toUniformArray(target) {
    const out = target || new Float32Array(8);
    out.set(this.color, 0);
    out[4] = this.roughness;
    out[5] = this.metalness;
    out[6] = 0.0;
    out[7] = 0.0;
    return out;
  }
}

export const DEFAULT_STANDARD_PBR_PARAMS = {
  color: DEFAULT_COLOR,
  roughness: DEFAULT_ROUGHNESS,
  metalness: DEFAULT_METALNESS,
  albedoTexture: null,
  albedoSampler: null,
  normalTexture: null,
  normalSampler: null,
  ormTexture: null,
  ormSampler: null
};
