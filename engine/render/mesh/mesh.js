const FLOAT32_BYTES = 4;
const VERTEX_FLOATS = 12;
const VERTEX_STRIDE = VERTEX_FLOATS * FLOAT32_BYTES;

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
    this.primitives = primitives.map(primitive => this._createPrimitive(primitive));
  }

  _createPrimitive({ vertexData, indexData = null, materialId = null }) {
    if (!(vertexData instanceof Float32Array)) {
      throw new Error('vertexData must be a Float32Array');
    }
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
    };
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
  }
}

export { VERTEX_FLOATS, VERTEX_STRIDE };
