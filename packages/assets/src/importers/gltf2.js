import { promises as fs } from 'fs';
import path from 'path';
import Instance from '../../../runtime-core/src/scene/Instance.js';

const COMPONENT_ARRAY = {
  5120: Int8Array,
  5121: Uint8Array,
  5122: Int16Array,
  5123: Uint16Array,
  5125: Uint32Array,
  5126: Float32Array
};

const TYPE_COMPONENTS = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT4: 16
};

function decodeDataURI(uri) {
  const match = /^data:(.*?);base64,(.*)$/.exec(uri);
  if (!match) throw new Error('Invalid data URI');
  return { data: Buffer.from(match[2], 'base64'), mime: match[1] };
}

function parseGLB(buffer) {
  const magic = buffer.toString('utf8', 0, 4);
  if (magic !== 'glTF') throw new Error('Invalid GLB magic');
  const jsonLength = buffer.readUInt32LE(12);
  const jsonChunk = buffer
    .slice(20, 20 + jsonLength)
    .toString('utf8')
    .replace(/\u0000/g, '');
  let offset = 20 + jsonLength;
  offset += (4 - (jsonLength % 4)) % 4;
  const binLength = buffer.readUInt32LE(offset);
  const binChunk = buffer.slice(offset + 8, offset + 8 + binLength);
  const json = JSON.parse(jsonChunk);
  return { json, binChunk };
}

export async function loadGLTF(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  let json, binChunk;
  if (ext === '.glb') {
    const data = await fs.readFile(filePath);
    ({ json, binChunk } = parseGLB(data));
  } else if (ext === '.gltf') {
    const text = await fs.readFile(filePath, 'utf8');
    json = JSON.parse(text);
  } else {
    throw new Error('Unsupported glTF format');
  }
  const baseDir = path.dirname(filePath);

  const buffers = await Promise.all((json.buffers || []).map(async (buf, i) => {
    if (buf.uri) {
      if (buf.uri.startsWith('data:')) {
        return decodeDataURI(buf.uri).data;
      }
      return fs.readFile(path.resolve(baseDir, buf.uri));
    }
    return i === 0 && binChunk ? binChunk : Buffer.alloc(0);
  }));

  const bufferViews = (json.bufferViews || []).map((bv) => {
    const b = buffers[bv.buffer];
    const byteOffset = bv.byteOffset || 0;
    return b.subarray(byteOffset, byteOffset + bv.byteLength);
  });

  const accessors = (json.accessors || []).map((acc) => {
    const ArrayType = COMPONENT_ARRAY[acc.componentType];
    const numComp = TYPE_COMPONENTS[acc.type];
    const view = bufferViews[acc.bufferView];
    const byteOffset = acc.byteOffset || 0;
    const length = acc.count * numComp;
    const array = new ArrayType(view.buffer, view.byteOffset + byteOffset, length);
    return { array, type: acc.type };
  });

  const images = await Promise.all((json.images || []).map(async (img) => {
    let buffer, mimeType = img.mimeType;
    if (img.uri) {
      if (img.uri.startsWith('data:')) {
        const res = decodeDataURI(img.uri);
        buffer = res.data;
        mimeType = res.mime;
      } else {
        const p = path.resolve(baseDir, img.uri);
        buffer = await fs.readFile(p);
        if (!mimeType) {
          const ext = path.extname(img.uri).toLowerCase();
          mimeType = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.tga' ? 'image/x-tga' : '';
        }
      }
    } else if (img.bufferView !== undefined) {
      buffer = bufferViews[img.bufferView];
    } else {
      buffer = Buffer.alloc(0);
    }
    if (process.env.USE_KTX2) {
      const { transcode } = await import('../../processors/texture-ktx2.mjs');
      const out = await transcode(buffer, mimeType);
      buffer = out.data;
      mimeType = out.mimeType || 'image/ktx2';
    }
    return { buffer, mimeType };
  }));

  const textures = (json.textures || []).map((tex) => ({ image: images[tex.source] }));

  const materials = (json.materials || []).map((mat) => {
    const m = { ...mat };
    const pbr = mat.pbrMetallicRoughness || {};
    const baseColorTex = pbr.baseColorTexture;
    if (baseColorTex) {
      m.pbrMetallicRoughness = {
        ...pbr,
        baseColorTexture: {
          ...baseColorTex,
          texture: textures[baseColorTex.index],
          image: textures[baseColorTex.index]?.image
        }
      };
    }
    return m;
  });

  const meshes = (json.meshes || []).map((mesh) => ({
    primitives: mesh.primitives.map((prim) => {
      const attributes = {};
      for (const [name, idx] of Object.entries(prim.attributes)) {
        attributes[name] = accessors[idx];
      }
      return {
        attributes,
        indices: prim.indices !== undefined ? accessors[prim.indices] : null,
        material: prim.material !== undefined ? materials[prim.material] : null
      };
    })
  }));

  const buildNode = (index) => {
    const node = json.nodes[index];
    const inst = new Instance({
      name: node.name || '',
      mesh: node.mesh !== undefined ? meshes[node.mesh] : null,
      matrix: node.matrix || null
    });
    inst.children = (node.children || []).map(buildNode);
    return inst;
  };

  const scene = json.scenes && json.scenes[json.scene ?? 0];
  const nodes = scene ? scene.nodes.map(buildNode) : [];

  return { json, buffers, images, materials, meshes, nodes };
}
