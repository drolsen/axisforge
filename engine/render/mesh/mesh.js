const FLOAT32_BYTES = 4;
const VERTEX_FLOATS = 12;
const VERTEX_STRIDE = VERTEX_FLOATS * FLOAT32_BYTES;

function createEmptyBounds() {
  return {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  };
}

function computeBoundsFromVertices(vertexData, stride = VERTEX_FLOATS) {
  if (!vertexData || vertexData.length === 0) {
    return null;
  }

  const bounds = createEmptyBounds();
  const vertexCount = Math.floor(vertexData.length / stride);

  for (let i = 0; i < vertexCount; i += 1) {
    const offset = i * stride;
    const x = vertexData[offset + 0];
    const y = vertexData[offset + 1];
    const z = vertexData[offset + 2];

    if (x < bounds.min[0]) bounds.min[0] = x;
    if (y < bounds.min[1]) bounds.min[1] = y;
    if (z < bounds.min[2]) bounds.min[2] = z;

    if (x > bounds.max[0]) bounds.max[0] = x;
    if (y > bounds.max[1]) bounds.max[1] = y;
    if (z > bounds.max[2]) bounds.max[2] = z;
  }

  return bounds;
}

function cloneBounds(bounds) {
  if (!bounds) {
    return null;
  }
  return {
    min: [...bounds.min],
    max: [...bounds.max],
  };
}

function mergeBounds(target, source) {
  if (!source) {
    return target;
  }
  if (!target) {
    return cloneBounds(source);
  }

  for (let i = 0; i < 3; i += 1) {
    if (source.min[i] < target.min[i]) target.min[i] = source.min[i];
    if (source.max[i] > target.max[i]) target.max[i] = source.max[i];
  }

  return target;
}

function createGPUBuffer(device, data, usage) {
  const buffer = device.createBuffer({
    size: data.byteLength,
    usage,
    mappedAtCreation: true,
  });
  const arrayConstructor = data.constructor;
  new arrayConstructor(buffer.getMappedRange()).set(data);
  buffer.unmap();
  return buffer;
}

function getIndexFormat(array) {
  if (!array) {
    return null;
  }
  if (array instanceof Uint32Array) {
    return 'uint32';
  }
  if (array instanceof Uint16Array) {
    return 'uint16';
  }
  if (array instanceof Uint8Array) {
    return 'uint8';
  }
  throw new Error('Unsupported index array type');
}

export default class Mesh {
  constructor(device, primitives = []) {
    this.device = device;
    this._cpuPrimitives = primitives.map(primitive => this._cloneCPUPrimitive(primitive));
    this.primitives = primitives.map(primitive => this._createPrimitive(primitive));
    this.bounds = null;
    this._computeMeshBounds();
  }

  _cloneCPUPrimitive({ vertexData, indexData = null, materialId = null }) {
    const clone = {
      vertexData: vertexData ? new Float32Array(vertexData) : null,
      indexData: null,
      indexType: null,
      materialId: materialId ?? null,
    };

    if (indexData && indexData.length) {
      const ctor = indexData.constructor;
      clone.indexData = new ctor(indexData);
      clone.indexType = getIndexFormat(indexData);
    }

    return clone;
  }

  _createPrimitive({ vertexData, indexData = null, materialId = null }) {
    if (!(vertexData instanceof Float32Array)) {
      throw new Error('vertexData must be a Float32Array');
    }
    const bounds = computeBoundsFromVertices(vertexData);
    const vertexBuffer = createGPUBuffer(
      this.device,
      vertexData,
      GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    );

    let indexBuffer = null;
    let indexFormat = null;
    let indexCount = 0;
    let vertexCount = vertexData.length / VERTEX_FLOATS;

    if (indexData && indexData.length) {
      indexBuffer = createGPUBuffer(
        this.device,
        indexData,
        GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      );
      indexFormat = getIndexFormat(indexData);
      indexCount = indexData.length;
    }

    return {
      vertexBuffer,
      vertexCount,
      indexBuffer,
      indexFormat,
      indexCount,
      materialId,
      bounds,
    };
  }

  getCPUPrimitives() {
    if (!Array.isArray(this._cpuPrimitives)) {
      return [];
    }
    return this._cpuPrimitives.map(primitive => ({
      vertexData: primitive.vertexData ? new Float32Array(primitive.vertexData) : null,
      indexData:
        primitive.indexData && primitive.indexData.constructor
          ? new primitive.indexData.constructor(primitive.indexData)
          : null,
      indexType: primitive.indexType || (primitive.indexData ? getIndexFormat(primitive.indexData) : null),
      materialId: primitive.materialId ?? null,
    }));
  }

  _computeMeshBounds() {
    let combined = null;
    for (const primitive of this.primitives) {
      if (!primitive?.bounds) {
        continue;
      }
      combined = mergeBounds(combined, primitive.bounds);
    }
    this.bounds = combined;
  }

  destroy() {
    for (const primitive of this.primitives) {
      if (primitive.vertexBuffer) {
        primitive.vertexBuffer.destroy();
      }
      if (primitive.indexBuffer) {
        primitive.indexBuffer.destroy();
      }
    }
    this.primitives.length = 0;
    if (Array.isArray(this._cpuPrimitives)) {
      this._cpuPrimitives.length = 0;
    }
  }
}

export { VERTEX_FLOATS, VERTEX_STRIDE };
