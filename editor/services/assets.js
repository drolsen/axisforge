const TEXTURE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.tga', '.ktx2']);
const MODEL_EXTS = new Set(['.gltf', '.glb']);
const AUDIO_EXTS = new Set(['.wav', '.ogg', '.mp3']);

const STORAGE_KEY = 'axisforge.assets.registry';
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function typeForExt(ext) {
  ext = ext.toLowerCase();
  if (TEXTURE_EXTS.has(ext)) return 'textures';
  if (MODEL_EXTS.has(ext)) return 'models';
  if (AUDIO_EXTS.has(ext)) return 'audio';
  return 'unknown';
}

function basename(filePath) {
  if (!filePath) return '';
  const normalized = String(filePath).replace(/\\/g, '/');
  const segments = normalized.split('/');
  return segments[segments.length - 1] || '';
}

function extension(name) {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx) : '';
}

function joinPosix(...parts) {
  const filtered = parts.filter(part => part != null && part !== '');
  if (filtered.length === 0) {
    return '';
  }
  return filtered
    .map(part => String(part).replace(/^[\\/]+|[\\/]+$/g, ''))
    .filter(part => part.length > 0)
    .join('/');
}

function toUint8Array(data) {
  if (data == null) {
    return null;
  }
  if (data instanceof Uint8Array) {
    return data;
  }
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  throw new Error('Unsupported binary data type');
}

function bytesToBase64(bytes) {
  if (!bytes) {
    return null;
  }
  let result = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    result +=
      BASE64_CHARS[(chunk >> 18) & 63] +
      BASE64_CHARS[(chunk >> 12) & 63] +
      BASE64_CHARS[(chunk >> 6) & 63] +
      BASE64_CHARS[chunk & 63];
  }
  const remaining = bytes.length - i;
  if (remaining === 1) {
    const byte = bytes[i];
    result +=
      BASE64_CHARS[(byte >> 2) & 63] +
      BASE64_CHARS[(byte & 0x03) << 4] +
      '==';
  } else if (remaining === 2) {
    const byte1 = bytes[i];
    const byte2 = bytes[i + 1];
    const chunk = (byte1 << 8) | byte2;
    result +=
      BASE64_CHARS[(chunk >> 10) & 63] +
      BASE64_CHARS[(chunk >> 4) & 63] +
      BASE64_CHARS[(chunk << 2) & 63] +
      '=';
  }
  return result;
}

function createMemoryStorage() {
  let snapshot = [];
  return {
    get() {
      return snapshot.map(cloneAsset);
    },
    set(assets) {
      snapshot = assets.map(cloneAsset);
    },
  };
}

function createPersistentStorage() {
  try {
    if (typeof globalThis !== 'undefined') {
      const ls = globalThis.localStorage;
      if (ls) {
        return {
          get() {
            try {
              const raw = ls.getItem(STORAGE_KEY);
              if (!raw) return [];
              const parsed = JSON.parse(raw);
              return Array.isArray(parsed) ? parsed.map(cloneAsset) : [];
            } catch {
              return [];
            }
          },
          set(assets) {
            try {
              ls.setItem(STORAGE_KEY, JSON.stringify(assets));
            } catch {
              // Ignore write failures (quota exceeded, etc.)
            }
          },
        };
      }
    }
  } catch {
    // Accessing localStorage can throw in some environments; fall back to memory.
  }
  return createMemoryStorage();
}

function cloneAsset(asset) {
  if (!asset) return asset;
  return {
    ...asset,
    source: asset.source ? { ...asset.source } : undefined,
  };
}

async function guidFromPath(logicalPath) {
  const encoder = new TextEncoder();
  const data = encoder.encode(logicalPath);
  const subtle = globalThis.crypto && globalThis.crypto.subtle;
  if (subtle && subtle.digest) {
    const hashBuffer = await subtle.digest('SHA-1', data);
    return arrayBufferToHex(hashBuffer);
  }
  return fallbackHash(data);
}

function arrayBufferToHex(buffer) {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

function fallbackHash(bytes) {
  const accum = new Uint32Array(5);
  for (let i = 0; i < bytes.length; i += 1) {
    accum[i % accum.length] = (accum[i % accum.length] * 33 + bytes[i]) >>> 0;
  }
  return Array.from(accum, n => n.toString(16).padStart(8, '0')).join('');
}

function createDefaultRegistryStorage() {
  return createPersistentStorage();
}

export class AssetRegistry {
  constructor(storage = createDefaultRegistryStorage()) {
    this.storage = storage;
    this.assets = [];
  }

  async load() {
    this.assets = this.storage.get();
  }

  async save() {
    this.storage.set(this.assets.map(cloneAsset));
  }

  async add(asset) {
    this.assets.push(cloneAsset(asset));
    await this.save();
  }

  list() {
    return this.assets.map(cloneAsset);
  }
}

export class AssetService {
  constructor(registry = new AssetRegistry()) {
    this.registry = registry;
    this.ready = this.registry.load();
  }

  async import(file) {
    await this.ready;
    const { name, payload, source } = await normalizeFileInput(file);
    const ext = extension(name).toLowerCase();
    const folder = typeForExt(ext);
    const logicalPath = joinPosix(folder, name);
    const guid = await guidFromPath(logicalPath);

    const asset = { type: folder, logicalPath, guid, name };
    if (payload) {
      asset.data = bytesToBase64(payload);
    }
    if (source) {
      asset.source = source;
    }
    await this.registry.add(asset);
    return asset;
  }

  async list() {
    await this.ready;
    const assets = this.registry.list();
    return assets.map(asset => {
      const status = asset.data != null
        ? 'decoded'
        : asset.source && asset.source.kind === 'path'
        ? 'external'
        : 'missing';
      return { ...asset, status };
    });
  }

  getURI(asset) {
    return `assets://${asset.logicalPath}`;
  }
}

async function normalizeFileInput(file) {
  if (!file) {
    throw new Error('No file provided');
  }

  if (typeof file === 'string') {
    return {
      name: basename(file),
      payload: null,
      source: { kind: 'path', value: file },
    };
  }

  if (typeof File !== 'undefined' && file instanceof File) {
    const buffer = await file.arrayBuffer();
    return { name: file.name, payload: new Uint8Array(buffer) };
  }

  if (typeof file.arrayBuffer === 'function') {
    const buffer = await file.arrayBuffer();
    return { name: file.name || basename(file.path) || 'asset', payload: new Uint8Array(buffer) };
  }

  if (file.buffer) {
    const payload = toUint8Array(file.buffer);
    const name = file.name || basename(file.path) || 'asset';
    return { name, payload };
  }

  if (file.base64) {
    const decoded = decodeBase64ToBytes(file.base64);
    const name = file.name || basename(file.path) || 'asset';
    return { name, payload: decoded };
  }

  throw new Error('Unsupported file input');
}

function decodeBase64ToBytes(base64) {
  const sanitized = String(base64).replace(/[^0-9a-zA-Z+/=]/g, '');
  const output = [];
  let buffer = 0;
  let bitsCollected = 0;

  for (const char of sanitized) {
    if (char === '=') {
      break;
    }
    const idx = BASE64_CHARS.indexOf(char);
    if (idx === -1) {
      continue;
    }
    buffer = (buffer << 6) | idx;
    bitsCollected += 6;
    if (bitsCollected >= 8) {
      bitsCollected -= 8;
      output.push((buffer >> bitsCollected) & 0xff);
    }
  }
  return new Uint8Array(output);
}

export default AssetService;
