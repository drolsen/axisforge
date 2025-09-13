import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

const INCOMING_DIR = path.resolve('assets/_incoming');
const PUBLIC_DIR = path.resolve('public/assets');
const REGISTRY_FILE = path.resolve('assets/registry.json');

const TEXTURE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.tga', '.ktx2']);
const MODEL_EXTS = new Set(['.gltf', '.glb']);
const AUDIO_EXTS = new Set(['.wav', '.ogg', '.mp3']);

function typeForExt(ext) {
  ext = ext.toLowerCase();
  if (TEXTURE_EXTS.has(ext)) return 'textures';
  if (MODEL_EXTS.has(ext)) return 'models';
  if (AUDIO_EXTS.has(ext)) return 'audio';
  return 'unknown';
}

function guidFromPath(logicalPath) {
  return crypto.createHash('sha1').update(logicalPath).digest('hex');
}

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export class AssetRegistry {
  constructor() {
    this.assets = [];
  }

  async load() {
    try {
      const data = await fs.readFile(REGISTRY_FILE, 'utf8');
      this.assets = JSON.parse(data);
    } catch {
      this.assets = [];
    }
  }

  async save() {
    await fs.mkdir(path.dirname(REGISTRY_FILE), { recursive: true });
    await fs.writeFile(REGISTRY_FILE, JSON.stringify(this.assets, null, 2));
  }

  async add(asset) {
    this.assets.push(asset);
    await this.save();
  }

  list() {
    return [...this.assets];
  }
}

export class AssetService {
  constructor(registry = new AssetRegistry()) {
    this.registry = registry;
    this.ready = this.registry.load();
  }

  async import(file) {
    await this.ready;
    let name;
    let buffer;
    if (typeof file === 'string') {
      name = path.basename(file);
      buffer = await fs.readFile(file);
    } else if (file && file.path) {
      name = path.basename(file.path);
      buffer = await fs.readFile(file.path);
    } else if (file && typeof file.arrayBuffer === 'function') {
      name = file.name;
      buffer = Buffer.from(await file.arrayBuffer());
    } else if (file && file.buffer) {
      name = file.name;
      buffer = file.buffer;
    } else {
      throw new Error('Unsupported file input');
    }
    const ext = path.extname(name);
    const folder = typeForExt(ext);
    const logicalPath = path.posix.join(folder, name);
    const guid = guidFromPath(logicalPath);
    const outPath = path.join(INCOMING_DIR, logicalPath + '.b64');
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    const b64 = buffer.toString('base64');
    await fs.writeFile(outPath, b64, 'utf8');
    const asset = { type: folder, logicalPath, guid };
    await this.registry.add(asset);
    return asset;
  }

  async list() {
    await this.ready;
    const assets = this.registry.list();
    for (const asset of assets) {
      asset.status = await this._status(asset.logicalPath);
    }
    return assets;
  }

  async _status(logicalPath) {
    const decodedPath = path.join(PUBLIC_DIR, logicalPath);
    const b64Path = path.join(INCOMING_DIR, logicalPath + '.b64');
    if (await fileExists(decodedPath)) return 'decoded';
    if (await fileExists(b64Path)) return 'pending (.b64)';
    return 'missing';
  }

  getURI(asset) {
    return `assets://${asset.logicalPath}`;
  }
}

export default AssetService;

