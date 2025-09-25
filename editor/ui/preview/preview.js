const TYPE_LABELS = {
  textures: 'Texture',
  materials: 'Material',
  models: 'Mesh',
  audio: 'Audio',
  unknown: 'Unknown',
};

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '—';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function guessMimeType(name = '') {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'ktx':
    case 'ktx2':
      return 'image/ktx2';
    default:
      return 'application/octet-stream';
  }
}

function base64ToBlob(base64, mimeType) {
  try {
    if (typeof Uint8Array !== 'function') {
      return null;
    }
    const binary = atob(base64);
    const length = binary.length;
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
  } catch (err) {
    console.warn('[Preview] Failed to decode base64', err);
    return null;
  }
}

function createMetadataRow(label, value) {
  const row = document.createElement('div');
  row.className = 'asset-preview__meta-row';
  const key = document.createElement('span');
  key.className = 'asset-preview__meta-key';
  key.textContent = label;
  const val = document.createElement('span');
  val.className = 'asset-preview__meta-value';
  val.textContent = value ?? '—';
  row.append(key, val);
  return row;
}

export default class AssetPreview {
  constructor() {
    this.asset = null;
    this.objectUrl = null;
    this.imageLoaded = false;
    this.element = document.createElement('div');
    this.element.className = 'asset-preview';

    this.thumbnail = document.createElement('div');
    this.thumbnail.className = 'asset-preview__thumb';
    this.image = document.createElement('img');
    this.image.alt = '';
    this.image.className = 'asset-preview__image';
    this.thumbnail.appendChild(this.image);

    this.placeholder = document.createElement('div');
    this.placeholder.className = 'asset-preview__placeholder';
    this.thumbnail.appendChild(this.placeholder);

    this.meta = document.createElement('div');
    this.meta.className = 'asset-preview__meta';

    this.element.append(this.thumbnail, this.meta);

    this.image.addEventListener('error', () => {
      this.thumbnail.classList.add('has-error');
    });
    this.image.addEventListener('load', () => {
      this.imageLoaded = true;
      this.thumbnail.classList.remove('is-loading');
      if (this.asset) {
        this._updateDimensions(this.image.naturalWidth, this.image.naturalHeight);
      }
    });
  }

  dispose() {
    this._revokeObjectUrl();
    this.asset = null;
  }

  setAsset(asset) {
    this.asset = asset || null;
    this.imageLoaded = false;
    this.thumbnail.classList.remove('has-error');
    this.thumbnail.classList.remove('is-loading');
    this.placeholder.textContent = '';
    this._revokeObjectUrl();
    this.image.src = '';
    this.meta.textContent = '';

    if (!asset) {
      this.placeholder.textContent = 'Select an asset to preview';
      this.thumbnail.classList.add('asset-preview__thumb--empty');
      return;
    }

    this.thumbnail.classList.remove('asset-preview__thumb--empty');
    this.placeholder.textContent = TYPE_LABELS[asset.type] || 'Asset';
    this.thumbnail.classList.add('is-loading');

    const rows = [];
    rows.push(createMetadataRow('Name', asset.name || asset.logicalPath || asset.guid || 'Asset'));
    rows.push(createMetadataRow('Type', TYPE_LABELS[asset.type] || 'Asset'));
    if (asset.logicalPath) {
      rows.push(createMetadataRow('Path', asset.logicalPath));
    }
    if (asset.size != null) {
      rows.push(createMetadataRow('Size', formatBytes(asset.size)));
    }
    this.meta.replaceChildren(...rows);

    if (asset.type === 'textures') {
      this._loadTexture(asset);
    } else {
      this.thumbnail.classList.remove('is-loading');
    }
  }

  _updateDimensions(width, height) {
    const existing = this.meta.querySelector('[data-meta="dimensions"]');
    const value = width && height ? `${width} × ${height}` : '—';
    if (existing) {
      existing.textContent = value;
      return;
    }
    const row = createMetadataRow('Dimensions', value);
    row.querySelector('.asset-preview__meta-key').dataset.meta = 'dimensions-label';
    row.querySelector('.asset-preview__meta-value').dataset.meta = 'dimensions';
    this.meta.appendChild(row);
  }

  async _loadTexture(asset) {
    if (asset.data) {
      await this._loadFromBase64(asset);
      return;
    }
    if (asset.source?.kind === 'path' && asset.source.value) {
      this.image.src = asset.source.value;
      return;
    }
    this.thumbnail.classList.remove('is-loading');
    this.placeholder.textContent = 'No preview available';
  }

  async _loadFromBase64(asset) {
    const mime = guessMimeType(asset.name || 'texture.png');
    let blob = null;
    if (typeof Blob === 'function' && typeof Uint8Array === 'function') {
      try {
        const decoded = typeof atob === 'function' ? base64ToBlob(asset.data, mime) : null;
        if (decoded) {
          blob = decoded;
        }
      } catch (err) {
        console.warn('[Preview] Failed to create blob from base64', err);
      }
    }
    if (!blob && typeof Buffer !== 'undefined') {
      try {
        const buf = Buffer.from(asset.data, 'base64');
        blob = new Blob([buf], { type: mime });
      } catch (err) {
        console.warn('[Preview] Failed to create blob via Buffer', err);
      }
    }
    if (!blob) {
      this.thumbnail.classList.remove('is-loading');
      this.placeholder.textContent = 'No preview available';
      return;
    }
    this.objectUrl = URL.createObjectURL(blob);
    this.image.src = this.objectUrl;
  }

  _revokeObjectUrl() {
    if (this.objectUrl) {
      try {
        URL.revokeObjectURL(this.objectUrl);
      } catch {
        // ignore
      }
      this.objectUrl = null;
    }
  }
}
