const importers = new Map();

export function registerImporter(ext, loader) {
  const key = ext.replace(/^\./, '').toLowerCase();
  importers.set(key, loader);
}

export async function load(uri) {
  const isB64 = uri.toLowerCase().endsWith('.b64');
  const cleanUri = isB64 ? uri.replace(/\.b64(?:[?#].*)?$/, '') : uri;
  const extMatch = /\.([^.?#]+)(?:[?#].*)?$/.exec(cleanUri);
  const ext = extMatch ? extMatch[1].toLowerCase() : '';
  const importer = importers.get(ext);
  if (!importer) {
    throw new Error(`No importer registered for extension: ${ext}`);
  }
  if (!isB64) {
    return importer(uri);
  }
  const res = await fetch(uri);
  if (!res.ok) throw new Error(`Failed to fetch ${uri}`);
  const base64 = (await res.text()).replace(/\s+/g, '');
  let buffer;
  if (typeof Buffer !== 'undefined') {
    buffer = Buffer.from(base64, 'base64');
  } else {
    const binary = atob(base64);
    buffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([buffer]);
  const url = URL.createObjectURL(blob);
  try {
    return await importer(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default { load, registerImporter };

import './importers/gltf2.js';
