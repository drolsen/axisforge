const DEVICE_SAMPLERS = new WeakMap();

function getStore(device) {
  let store = DEVICE_SAMPLERS.get(device);
  if (!store) {
    store = new Map();
    DEVICE_SAMPLERS.set(device, store);
  }
  return store;
}

function keyFromDescriptor(descriptor) {
  const entries = Object.entries(descriptor || {}).sort(([a], [b]) => {
    if (a === b) return 0;
    return a < b ? -1 : 1;
  });
  return JSON.stringify(entries);
}

function supportsAnisotropy(device) {
  try {
    return typeof device?.features?.has === 'function' && device.features.has('anisotropic-filtering');
  } catch {
    return false;
  }
}

export function createSampler(device, descriptor = {}) {
  if (!device) {
    throw new Error('GPU device is required to create a sampler');
  }
  const finalDescriptor = { ...descriptor };
  if (finalDescriptor.maxAnisotropy != null) {
    if (!supportsAnisotropy(device)) {
      delete finalDescriptor.maxAnisotropy;
    }
  }
  return device.createSampler(finalDescriptor);
}

export function getDefaultLinearSampler(device) {
  const store = getStore(device);
  const key = 'linear';
  if (!store.has(key)) {
    store.set(key, createSampler(device, {
      label: 'DefaultLinearSampler',
      addressModeU: 'repeat',
      addressModeV: 'repeat',
      magFilter: 'linear',
      minFilter: 'linear',
      mipmapFilter: 'linear',
      lodMinClamp: 0,
      lodMaxClamp: 12,
    }));
  }
  return store.get(key);
}

export function getDefaultAnisotropicSampler(device) {
  const store = getStore(device);
  const key = 'anisotropic';
  if (!store.has(key)) {
    const descriptor = {
      label: 'DefaultAnisotropicSampler',
      addressModeU: 'repeat',
      addressModeV: 'repeat',
      magFilter: 'linear',
      minFilter: 'linear',
      mipmapFilter: 'linear',
      lodMinClamp: 0,
      lodMaxClamp: 12,
    };
    if (supportsAnisotropy(device)) {
      descriptor.maxAnisotropy = 8;
    }
    store.set(key, createSampler(device, descriptor));
  }
  return store.get(key);
}

export function getOrCreateSampler(device, descriptor = {}) {
  const store = getStore(device);
  const key = keyFromDescriptor(descriptor);
  if (!store.has(key)) {
    store.set(key, createSampler(device, descriptor));
  }
  return store.get(key);
}
