// Shared sampler cache with anisotropy support
// Interface: SamplerCache.get(params) -> sampler

const cache = new Map();

export function get(device, params = {}) {
  const key = JSON.stringify(params);
  let sampler = cache.get(key);
  if (!sampler) {
    sampler = device.createSampler({
      addressModeU: params.addressModeU || 'repeat',
      addressModeV: params.addressModeV || 'repeat',
      magFilter: params.magFilter || 'linear',
      minFilter: params.minFilter || 'linear',
      mipmapFilter: params.mipmapFilter || 'linear',
      maxAnisotropy: params.maxAnisotropy || 1,
    });
    cache.set(key, sampler);
  }
  return sampler;
}

export function clear() {
  cache.clear();
}

export default { get, clear };
