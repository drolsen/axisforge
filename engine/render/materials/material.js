const DEFAULT_COLOR = [1, 1, 1, 1];
const DEFAULT_ROUGHNESS = 1.0;
const DEFAULT_METALNESS = 0.0;
const DEFAULT_EMISSIVE = [0, 0, 0];
const DEFAULT_OCCLUSION = 1.0;

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
    this.emissive = new Float32Array([...(params.emissive || DEFAULT_EMISSIVE), 0]);
    this.occlusionStrength = params.occlusionStrength ?? DEFAULT_OCCLUSION;

    this.maps = {
      albedo: { texture: null, sampler: null },
      metallicRoughness: { texture: null, sampler: null },
      normal: { texture: null, sampler: null },
      occlusion: { texture: null, sampler: null },
      emissive: { texture: null, sampler: null },
    };

    this.update(params);
  }

  update(params = {}) {
    if (Object.prototype.hasOwnProperty.call(params, 'baseColorFactor')) {
      this.color = toVec4Color(params.baseColorFactor);
    }
    if (Object.prototype.hasOwnProperty.call(params, 'color')) {
      this.color = toVec4Color(params.color);
    }
    if (Object.prototype.hasOwnProperty.call(params, 'roughnessFactor') && typeof params.roughnessFactor === 'number') {
      this.roughness = params.roughnessFactor;
    } else if (Object.prototype.hasOwnProperty.call(params, 'roughness') && typeof params.roughness === 'number') {
      this.roughness = params.roughness;
    }
    if (Object.prototype.hasOwnProperty.call(params, 'metallicFactor') && typeof params.metallicFactor === 'number') {
      this.metalness = params.metallicFactor;
    } else if (Object.prototype.hasOwnProperty.call(params, 'metalness') && typeof params.metalness === 'number') {
      this.metalness = params.metalness;
    }
    if (Object.prototype.hasOwnProperty.call(params, 'emissive')) {
      const arr = Array.from(params.emissive ?? DEFAULT_EMISSIVE);
      while (arr.length < 3) arr.push(0);
      this.emissive = new Float32Array([...arr.slice(0, 3), 0]);
    }
    if (Object.prototype.hasOwnProperty.call(params, 'emissiveFactor')) {
      const arr = Array.from(params.emissiveFactor ?? DEFAULT_EMISSIVE);
      while (arr.length < 3) arr.push(0);
      this.emissive = new Float32Array([...arr.slice(0, 3), 0]);
    }
    if (Object.prototype.hasOwnProperty.call(params, 'occlusionStrength') && typeof params.occlusionStrength === 'number') {
      this.occlusionStrength = params.occlusionStrength;
    }

    if (Object.prototype.hasOwnProperty.call(params, 'albedoTexture')) {
      this.maps.albedo.texture = params.albedoTexture;
    }
    if (Object.prototype.hasOwnProperty.call(params, 'baseColorTexture')) {
      this.maps.albedo.texture = params.baseColorTexture;
    }
    if (Object.prototype.hasOwnProperty.call(params, 'albedoSampler')) {
      this.maps.albedo.sampler = params.albedoSampler;
    }
    if (Object.prototype.hasOwnProperty.call(params, 'baseColorSampler')) {
      this.maps.albedo.sampler = params.baseColorSampler;
    }
    if (Object.prototype.hasOwnProperty.call(params, 'metallicRoughnessTexture')) {
      this.maps.metallicRoughness.texture = params.metallicRoughnessTexture;
    }
    if (Object.prototype.hasOwnProperty.call(params, 'metallicRoughnessSampler')) {
      this.maps.metallicRoughness.sampler = params.metallicRoughnessSampler;
    }
    if (Object.prototype.hasOwnProperty.call(params, 'normalTexture')) {
      this.maps.normal.texture = params.normalTexture;
    }
    if (Object.prototype.hasOwnProperty.call(params, 'normalSampler')) {
      this.maps.normal.sampler = params.normalSampler;
    }
    if (Object.prototype.hasOwnProperty.call(params, 'occlusionTexture')) {
      this.maps.occlusion.texture = params.occlusionTexture;
    }
    if (Object.prototype.hasOwnProperty.call(params, 'occlusionSampler')) {
      this.maps.occlusion.sampler = params.occlusionSampler;
    }
    if (Object.prototype.hasOwnProperty.call(params, 'emissiveTexture')) {
      this.maps.emissive.texture = params.emissiveTexture;
    }
    if (Object.prototype.hasOwnProperty.call(params, 'emissiveSampler')) {
      this.maps.emissive.sampler = params.emissiveSampler;
    }
  }

  toUniformArray(target) {
    const out = target || new Float32Array(12);
    out.set(this.color, 0);
    out[4] = this.emissive[0];
    out[5] = this.emissive[1];
    out[6] = this.emissive[2];
    out[7] = this.occlusionStrength;
    out[8] = this.roughness;
    out[9] = this.metalness;
    out[10] = 0.0;
    out[11] = 0.0;
    return out;
  }
}

export const DEFAULT_STANDARD_PBR_PARAMS = {
  color: DEFAULT_COLOR,
  roughness: DEFAULT_ROUGHNESS,
  metalness: DEFAULT_METALNESS,
  emissive: DEFAULT_EMISSIVE,
  occlusionStrength: DEFAULT_OCCLUSION,
  albedoTexture: null,
  albedoSampler: null,
  metallicRoughnessTexture: null,
  metallicRoughnessSampler: null,
  normalTexture: null,
  normalSampler: null,
  occlusionTexture: null,
  occlusionSampler: null,
  emissiveTexture: null,
  emissiveSampler: null,
};
