const COMPONENT_INFO = {
  5120: { ctor: Int8Array, size: 1, normalized: { min: -128, max: 127 } }, // BYTE
  5121: { ctor: Uint8Array, size: 1, normalized: { min: 0, max: 255 } }, // UNSIGNED_BYTE
  5122: { ctor: Int16Array, size: 2, normalized: { min: -32768, max: 32767 } }, // SHORT
  5123: { ctor: Uint16Array, size: 2, normalized: { min: 0, max: 65535 } }, // UNSIGNED_SHORT
  5125: { ctor: Uint32Array, size: 4, normalized: { min: 0, max: 4294967295 } }, // UNSIGNED_INT
  5126: { ctor: Float32Array, size: 4 }, // FLOAT
};

const TYPE_COMPONENTS = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16,
};

function getComponentInfo(componentType) {
  const info = COMPONENT_INFO[componentType];
  if (!info) {
    throw new Error(`Unsupported glTF component type ${componentType}`);
  }
  return info;
}

function getComponentCount(type) {
  const count = TYPE_COMPONENTS[type];
  if (!count) {
    throw new Error(`Unsupported glTF accessor type ${type}`);
  }
  return count;
}

function readComponent(dataView, byteOffset, componentType) {
  switch (componentType) {
    case 5120:
      return dataView.getInt8(byteOffset);
    case 5121:
      return dataView.getUint8(byteOffset);
    case 5122:
      return dataView.getInt16(byteOffset, true);
    case 5123:
      return dataView.getUint16(byteOffset, true);
    case 5125:
      return dataView.getUint32(byteOffset, true);
    case 5126:
      return dataView.getFloat32(byteOffset, true);
    default:
      throw new Error(`Unsupported component type ${componentType}`);
  }
}

function normalizeValue(value, componentType) {
  const info = COMPONENT_INFO[componentType];
  if (!info || !info.normalized) {
    return value;
  }
  const { min, max } = info.normalized;
  if (min < 0) {
    const range = max;
    const v = value / range;
    return Math.max(-1, Math.min(1, v));
  }
  const range = max === 0 ? 1 : max;
  return Math.max(0, Math.min(1, value / range));
}

export function getAccessorArray(gltf, accessorIndex, buffers, { forceFloat = false } = {}) {
  const accessor = gltf.accessors?.[accessorIndex];
  if (!accessor) {
    throw new Error(`Accessor ${accessorIndex} not found`);
  }
  if (typeof accessor.bufferView !== 'number') {
    throw new Error('Sparse accessors without bufferView are not supported');
  }
  const bufferView = gltf.bufferViews?.[accessor.bufferView];
  if (!bufferView) {
    throw new Error(`BufferView ${accessor.bufferView} not found`);
  }
  const buffer = buffers?.[bufferView.buffer];
  if (!buffer) {
    throw new Error(`Buffer ${bufferView.buffer} not loaded`);
  }

  const componentInfo = getComponentInfo(accessor.componentType);
  const componentCount = getComponentCount(accessor.type);
  const count = accessor.count || 0;
  const byteOffset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
  const stride = bufferView.byteStride || componentInfo.size * componentCount;
  const normalized = Boolean(accessor.normalized);
  const useFloat = forceFloat || componentInfo.ctor === Float32Array;

  if (count === 0) {
    return useFloat ? new Float32Array(0) : new componentInfo.ctor(0);
  }

  if (stride === componentInfo.size * componentCount && !normalized && !forceFloat && componentInfo.ctor !== Float32Array) {
    return new componentInfo.ctor(buffer, byteOffset, count * componentCount);
  }

  const elementStride = stride;
  const dataViewLength = elementStride * (count - 1) + componentInfo.size * componentCount;
  const dataView = new DataView(buffer, byteOffset, dataViewLength);
  const output = useFloat ? new Float32Array(count * componentCount) : new componentInfo.ctor(count * componentCount);

  for (let i = 0; i < count; i += 1) {
    for (let c = 0; c < componentCount; c += 1) {
      const offset = i * elementStride + c * componentInfo.size;
      let value = readComponent(dataView, offset, accessor.componentType);
      if (normalized) {
        value = normalizeValue(value, accessor.componentType);
      } else if (useFloat && componentInfo.ctor !== Float32Array) {
        value = Number(value);
      }
      output[i * componentCount + c] = value;
    }
  }

  return output;
}

export function isSRGBTextureSlot(slot) {
  return slot === 'baseColor' || slot === 'emissive';
}

export function resolveUri(baseUri, target) {
  if (!target) {
    return baseUri;
  }
  if (/^https?:\/\//i.test(target) || /^data:/i.test(target)) {
    return target;
  }
  if (!baseUri) {
    return target;
  }
  try {
    const url = new URL(target, baseUri);
    return url.toString();
  } catch {
    if (baseUri.endsWith('/')) {
      return `${baseUri}${target}`;
    }
    return `${baseUri}/${target}`;
  }
}
