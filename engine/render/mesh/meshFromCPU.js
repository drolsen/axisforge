import { VERTEX_FLOATS } from './mesh.js';

function ensureDevice(device) {
  if (!device) {
    throw new Error('GPU device is required to create meshes.');
  }
  return device;
}

function computeBounds(positions) {
  if (!positions || positions.length < 3) {
    return { min: [0, 0, 0], max: [0, 0, 0] };
  }
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i + 0];
    const y = positions[i + 1];
    const z = positions[i + 2];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }
  return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] };
}

function normalizeVector3(nx, ny, nz) {
  const len = Math.hypot(nx, ny, nz);
  if (len < 1e-5) {
    return [1, 0, 0];
  }
  return [nx / len, ny / len, nz / len];
}

function defaultTangent(nx, ny, nz) {
  const up = Math.abs(ny) < 0.999 ? [0, 1, 0] : [0, 0, 1];
  let tx = up[1] * nz - up[2] * ny;
  let ty = up[2] * nx - up[0] * nz;
  let tz = up[0] * ny - up[1] * nx;
  const [rx, ry, rz] = normalizeVector3(tx, ty, tz);
  if (Number.isNaN(rx) || Number.isNaN(ry) || Number.isNaN(rz)) {
    return [1, 0, 0, 1];
  }
  return [rx, ry, rz, 1];
}

function toTypedIndices(indices) {
  if (!indices || !indices.length) {
    return null;
  }
  if (indices instanceof Uint16Array || indices instanceof Uint32Array || indices instanceof Uint8Array) {
    return indices;
  }
  const maxIndex = indices.reduce((max, value) => Math.max(max, value), 0);
  if (maxIndex < 256) {
    return Uint8Array.from(indices);
  }
  if (maxIndex < 65536) {
    return Uint16Array.from(indices);
  }
  return Uint32Array.from(indices);
}

export function createMeshFromCPU(device, cpu) {
  ensureDevice(device);
  if (!cpu || !cpu.positions) {
    throw new Error('CPU mesh must include positions.');
  }
  const positions = cpu.positions;
  const normals = cpu.normals ?? new Float32Array(positions.length);
  const uvs = cpu.uvs ?? new Float32Array((positions.length / 3) * 2);
  const tangents = cpu.tangents ?? null;
  const vertexCount = positions.length / 3;
  if (!Number.isFinite(vertexCount) || !Number.isInteger(vertexCount)) {
    throw new Error('Invalid vertex count for CPU mesh.');
  }

  const vertexData = new Float32Array(vertexCount * VERTEX_FLOATS);
  for (let i = 0; i < vertexCount; i += 1) {
    const pIndex = i * 3;
    const uvIndex = i * 2;
    const tIndex = i * 4;
    const offset = i * VERTEX_FLOATS;

    vertexData[offset + 0] = positions[pIndex + 0];
    vertexData[offset + 1] = positions[pIndex + 1];
    vertexData[offset + 2] = positions[pIndex + 2];

    vertexData[offset + 3] = normals[pIndex + 0] ?? 0;
    vertexData[offset + 4] = normals[pIndex + 1] ?? 1;
    vertexData[offset + 5] = normals[pIndex + 2] ?? 0;

    let tangentX = 1;
    let tangentY = 0;
    let tangentZ = 0;
    let tangentW = 1;
    if (tangents && tangents.length >= tIndex + 4) {
      tangentX = tangents[tIndex + 0];
      tangentY = tangents[tIndex + 1];
      tangentZ = tangents[tIndex + 2];
      tangentW = tangents[tIndex + 3];
    } else {
      const [nx, ny, nz] = [vertexData[offset + 3], vertexData[offset + 4], vertexData[offset + 5]];
      const [tx, ty, tz, tw] = defaultTangent(nx, ny, nz);
      tangentX = tx;
      tangentY = ty;
      tangentZ = tz;
      tangentW = tw;
    }

    vertexData[offset + 6] = tangentX;
    vertexData[offset + 7] = tangentY;
    vertexData[offset + 8] = tangentZ;
    vertexData[offset + 9] = tangentW;

    vertexData[offset + 10] = uvs[uvIndex + 0] ?? 0;
    vertexData[offset + 11] = uvs[uvIndex + 1] ?? 0;
  }

  const vertexBuffer = device.createBuffer({
    size: vertexData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(vertexBuffer, 0, vertexData.buffer, vertexData.byteOffset, vertexData.byteLength);

  const typedIndices = toTypedIndices(cpu.indices);
  let indexBuffer = null;
  let indexFormat = null;
  let indexCount = 0;
  if (typedIndices) {
    indexBuffer = device.createBuffer({
      size: typedIndices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(indexBuffer, 0, typedIndices.buffer, typedIndices.byteOffset, typedIndices.byteLength);
    indexCount = typedIndices.length;
    if (typedIndices instanceof Uint16Array) {
      indexFormat = 'uint16';
    } else if (typedIndices instanceof Uint8Array) {
      indexFormat = 'uint8';
    } else {
      indexFormat = 'uint32';
    }
  }

  const bounds = computeBounds(positions);

  return {
    bounds,
    primitives: [
      {
        vertexBuffer,
        vertexCount,
        indexBuffer,
        indexFormat,
        indexCount,
        materialId: cpu.materialId ?? null,
        bounds,
      },
    ],
  };
}

export default createMeshFromCPU;
