import { resolveUri } from './utils.js';

const DATA_URI_REGEX = /^data:([^;,]*)(;base64)?,([\s\S]*)$/i;

function getBaseUri(source) {
  if (!source) {
    return '';
  }
  const url = String(source);
  const idx = url.lastIndexOf('/');
  if (idx === -1) {
    return '';
  }
  return url.slice(0, idx + 1);
}

function decodeBase64(base64) {
  if (typeof atob === 'function') {
    const binary = atob(base64);
    const length = binary.length;
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  if (typeof Buffer === 'function') {
    const buffer = Buffer.from(base64, 'base64');
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }
  throw new Error('Base64 decoding is not supported in this environment');
}

function decodeTextData(data) {
  const decoded = decodeURIComponent(data);
  const length = decoded.length;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) {
    bytes[i] = decoded.charCodeAt(i) & 0xff;
  }
  return bytes;
}

function parseDataUri(uri) {
  const match = DATA_URI_REGEX.exec(uri);
  if (!match) {
    return null;
  }
  const mimeType = match[1] || 'application/octet-stream';
  const isBase64 = Boolean(match[2]);
  const dataPart = match[3] || '';
  const bytes = isBase64 ? decodeBase64(dataPart) : decodeTextData(dataPart);
  return { mimeType, bytes, buffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
}

async function fetchArrayBuffer(fetchFn, uri) {
  if (typeof uri === 'string' && /^data:/i.test(uri)) {
    const parsed = parseDataUri(uri);
    if (!parsed) {
      throw new Error(`Failed to parse data URI: ${uri}`);
    }
    return parsed.buffer;
  }
  const res = await fetchFn(uri);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${uri}: ${res.status} ${res.statusText}`);
  }
  return await res.arrayBuffer();
}

async function fetchJSON(fetchFn, uri) {
  const res = await fetchFn(uri);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${uri}: ${res.status} ${res.statusText}`);
  }
  return await res.json();
}

async function loadImage(fetchFn, uri) {
  if (typeof uri === 'string' && /^data:/i.test(uri)) {
    const parsed = parseDataUri(uri);
    if (!parsed) {
      throw new Error(`Failed to parse data URI: ${uri}`);
    }
    const blob = new Blob([parsed.buffer], { type: parsed.mimeType });
    if (typeof createImageBitmap === 'function') {
      return await createImageBitmap(blob);
    }
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = uri;
    });
  }
  const res = await fetchFn(uri);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${uri}: ${res.status} ${res.statusText}`);
  }
  const blob = await res.blob();
  if (typeof createImageBitmap === 'function') {
    return await createImageBitmap(blob);
  }
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}

function viewToBlob(gltf, imageDef, buffers) {
  const bufferView = gltf.bufferViews?.[imageDef.bufferView];
  if (!bufferView) {
    throw new Error(`BufferView ${imageDef.bufferView} missing for embedded image`);
  }
  const buffer = buffers?.[bufferView.buffer];
  if (!buffer) {
    throw new Error(`Buffer ${bufferView.buffer} missing for embedded image`);
  }
  const offset = bufferView.byteOffset || 0;
  const length = bufferView.byteLength || buffer.byteLength - offset;
  const slice = buffer.slice(offset, offset + length);
  return new Blob([slice], { type: imageDef.mimeType || 'application/octet-stream' });
}

async function loadImageFromBufferView(gltf, imageDef, buffers) {
  const blob = viewToBlob(gltf, imageDef, buffers);
  if (typeof createImageBitmap === 'function') {
    return await createImageBitmap(blob);
  }
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}

export async function loadGLTF(source, options = {}) {
  const fetchFn = options.fetch ?? (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
  if (!fetchFn) {
    throw new Error('Global fetch() is not available; provide options.fetch');
  }

  if (typeof source !== 'string') {
    throw new Error('loadGLTF currently supports string URLs only');
  }

  const baseUri = options.baseUri || getBaseUri(source);
  const gltf = await fetchJSON(fetchFn, source);

  const buffers = await Promise.all((gltf.buffers || []).map(async (bufferDef, index) => {
    if (!bufferDef.uri) {
      throw new Error(`Buffer #${index} is missing a URI. GLB files are not supported yet.`);
    }
    const uri = resolveUri(baseUri, bufferDef.uri);
    return await fetchArrayBuffer(fetchFn, uri);
  }));

  const images = await Promise.all((gltf.images || []).map(async imageDef => {
    if (typeof imageDef.bufferView === 'number') {
      const bitmap = await loadImageFromBufferView(gltf, imageDef, buffers);
      return { bitmap, mimeType: imageDef.mimeType || 'image/png', name: imageDef.name || null };
    }
    if (!imageDef.uri) {
      throw new Error('Image is missing both uri and bufferView');
    }
    const uri = resolveUri(baseUri, imageDef.uri);
    const bitmap = await loadImage(fetchFn, uri);
    return { bitmap, mimeType: imageDef.mimeType || 'image/png', name: imageDef.name || null, uri };
  }));

  return { gltf, buffers, images, baseUri };
}

export default loadGLTF;
