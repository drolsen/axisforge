import { registerImporter } from '../AssetDB.js';

function decodeDataUri(uri) {
  const base64 = uri.split(',')[1];
  if (typeof Buffer !== 'undefined') {
    return Uint8Array.from(Buffer.from(base64, 'base64')).buffer;
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function getBase(path) {
  const idx = path.lastIndexOf('/');
  return idx >= 0 ? path.slice(0, idx + 1) : '';
}

function composeTransform(node) {
  if (node.matrix) {
    return new Float32Array(node.matrix);
  }
  const t = node.translation || [0, 0, 0];
  const r = node.rotation || [0, 0, 0, 1];
  const s = node.scale || [1, 1, 1];
  const [x, y, z, w] = r;
  const [sx, sy, sz] = s;
  const [tx, ty, tz] = t;
  const xx = x * x, yy = y * y, zz = z * z;
  const xy = x * y, xz = x * z, yz = y * z;
  const wx = w * x, wy = w * y, wz = w * z;
  const m = new Float32Array(16);
  m[0] = (1 - 2 * (yy + zz)) * sx; m[1] = (2 * (xy + wz)) * sx; m[2] = (2 * (xz - wy)) * sx; m[3] = 0;
  m[4] = (2 * (xy - wz)) * sy; m[5] = (1 - 2 * (xx + zz)) * sy; m[6] = (2 * (yz + wx)) * sy; m[7] = 0;
  m[8] = (2 * (xz + wy)) * sz; m[9] = (2 * (yz - wx)) * sz; m[10] = (1 - 2 * (xx + yy)) * sz; m[11] = 0;
  m[12] = tx; m[13] = ty; m[14] = tz; m[15] = 1;
  return m;
}

async function fetchArrayBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return res.arrayBuffer();
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return res.json();
}

function parseGLB(buffer) {
  const view = new DataView(buffer);
  const magic = view.getUint32(0, true);
  if (magic !== 0x46546c67) throw new Error('Invalid glb');
  const version = view.getUint32(4, true);
  if (version !== 2) throw new Error('Unsupported glb version');
  const length = view.getUint32(8, true);
  let offset = 12;
  let json = null;
  let bin = null;
  while (offset < length) {
    const chunkLen = view.getUint32(offset, true); offset += 4;
    const chunkType = view.getUint32(offset, true); offset += 4;
    if (chunkType === 0x4e4f534a) {
      const chunk = new Uint8Array(buffer, offset, chunkLen);
      json = JSON.parse(new TextDecoder().decode(chunk));
    } else if (chunkType === 0x004e4942) {
      bin = buffer.slice(offset, offset + chunkLen);
    }
    offset += chunkLen;
  }
  return { json, bin };
}

const COMPONENT_TYPE = {
  5120: Int8Array,
  5121: Uint8Array,
  5122: Int16Array,
  5123: Uint16Array,
  5125: Uint32Array,
  5126: Float32Array,
};

const TYPE_SIZE = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT4: 16,
};

export async function loadGLTF(uri) {
  const base = getBase(uri);
  let json, bin;
  if (uri.toLowerCase().endsWith('.glb')) {
    const buffer = await fetchArrayBuffer(uri);
    ({ json, bin } = parseGLB(buffer));
  } else {
    json = await fetchJSON(uri);
  }

  const buffers = await Promise.all((json.buffers || []).map((b, i) => {
    if (i === 0 && bin) return bin;
    if (b.uri.startsWith('data:')) return decodeDataUri(b.uri);
    return fetchArrayBuffer(base + b.uri);
  }));

  const bufferViews = (json.bufferViews || []).map(v => {
    const buffer = buffers[v.buffer];
    const byteOffset = v.byteOffset || 0;
    return new Uint8Array(buffer, byteOffset, v.byteLength);
  });

  const accessors = (json.accessors || []).map(a => {
    const view = json.bufferViews[a.bufferView];
    const TypedArray = COMPONENT_TYPE[a.componentType];
    const numComp = TYPE_SIZE[a.type];
    const byteOffset = (view.byteOffset || 0) + (a.byteOffset || 0);
    return new TypedArray(buffers[view.buffer], byteOffset, a.count * numComp);
  });

  const images = await Promise.all((json.images || []).map(async img => {
    if (img.uri) {
      if (img.uri.startsWith('data:')) return img.uri;
      return base + img.uri;
    }
    if (img.bufferView != null) {
      const view = json.bufferViews[img.bufferView];
      const buf = buffers[view.buffer].slice(view.byteOffset || 0, (view.byteOffset||0) + view.byteLength);
      const blob = new Blob([buf], { type: img.mimeType });
      return URL.createObjectURL(blob);
    }
    return null;
  }));

  const materials = (json.materials || []).map(m => {
    const pbr = m.pbrMetallicRoughness || {};
    const baseColorTexture = pbr.baseColorTexture ? images[pbr.baseColorTexture.index] : null;
    return {
      name: m.name,
      baseColorTexture,
      metallic: pbr.metallicFactor ?? 1,
      roughness: pbr.roughnessFactor ?? 1,
    };
  });

  const meshes = (json.meshes || []).map(mesh => {
    return mesh.primitives.map(prim => {
      const attributes = {};
      for (const [sem, idx] of Object.entries(prim.attributes)) {
        attributes[sem.toLowerCase()] = accessors[idx];
      }
      const indices = prim.indices != null ? accessors[prim.indices] : null;
      return {
        attributes,
        indices,
        material: materials[prim.material] || null,
      };
    });
  });

  const nodes = (json.nodes || []).map(node => {
    return {
      name: node.name,
      mesh: node.mesh != null ? meshes[node.mesh] : null,
      children: node.children || [],
      matrix: composeTransform(node),
    };
  });

  const scenes = (json.scenes || []).map(sc => ({ nodes: (sc.nodes || []).map(i => nodes[i]) }));
  const scene = json.scene != null ? scenes[json.scene] : scenes[0];

  return { scenes, scene, nodes, meshes, materials, images };
}

registerImporter('gltf', loadGLTF);
registerImporter('glb', loadGLTF);

export default loadGLTF;
