import AssetService from '../services/assets.js';
import importGLTF from '../../engine/asset/gltf/importer.js';
import { getWorkspace } from '../../engine/scene/workspace.js';
import { tryGetDevice } from '../../engine/render/gpu/device.js';
import { showToast } from '../ui/toast.js';
import { showProgress, hideProgress } from '../ui/progress.js';
import showContextMenu from '../ui/contextmenu.js';
import AssetPreview from '../ui/preview/preview.js';
import { registerDragSource } from '../ui/dropdrag.js';
import MaterialRegistry from '../services/materialRegistry.js';

const TYPE_LABELS = {
  textures: 'Texture',
  materials: 'Material',
  models: 'Mesh',
  audio: 'Audio',
  unknown: 'Unknown',
};

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'textures', label: 'Textures' },
  { id: 'materials', label: 'Materials' },
  { id: 'models', label: 'Meshes' },
  { id: 'audio', label: 'Audio' },
];

function normalizeName(asset) {
  return asset?.name || asset?.logicalPath || asset?.guid || 'Asset';
}

function matchFilter(asset, filter) {
  if (!filter || filter === 'all') return true;
  return asset?.type === filter;
}

function matchSearch(asset, query) {
  if (!query) return true;
  const haystack = `${asset?.name ?? ''} ${asset?.logicalPath ?? ''}`.toLowerCase();
  return haystack.includes(query);
}

function formatType(asset) {
  return TYPE_LABELS[asset?.type] || 'Asset';
}

function formatStatus(asset) {
  if (!asset) return '';
  if (asset.status === 'decoded') return 'Embedded';
  if (asset.status === 'external') return 'Linked';
  if (asset.status === 'missing') return 'Missing';
  return asset.status || '';
}

export default class AssetsPane {
  constructor(service = new AssetService(), options = {}) {
    const { floatingUI = true, materials = MaterialRegistry } = options ?? {};
    this.service = service;
    this.materials = materials;
    this.workspace = getWorkspace();
    this.assets = [];
    this.filtered = [];
    this.selection = null;
    this.filter = 'all';
    this.viewMode = 'grid';
    this.searchQuery = '';
    this.hasDOM = typeof document !== 'undefined';
    this._dragDisposers = new Map();
    this._filtersElement = null;
    this._searchInput = null;

    if (this.hasDOM) {
      this.element = this._createRoot();
      if (floatingUI) {
        this._setupFloatingImport();
      }
    } else {
      this.element = null;
    }

    this._changeListener = this.service.on('change', () => {
      this.refresh();
    });

    this.refresh();
  }

  dispose() {
    if (typeof this._changeListener === 'function') {
      this._changeListener();
      this._changeListener = null;
    }
    for (const dispose of this._dragDisposers.values()) {
      dispose?.();
    }
    this._dragDisposers.clear();
    if (this.preview) {
      this.preview.dispose();
    }
    if (this.element && this.element.parentElement) {
      this.element.parentElement.removeChild(this.element);
    }
  }

  async import(files) {
    const list = Array.isArray(files) ? files : [files];
    const results = [];
    for (const file of list) {
      const label = typeof file === 'string' ? file.split('/').pop() : file?.name || 'asset';
      const progressId = `import:${label}:${Date.now()}`;
      showProgress(progressId, { title: `Importing ${label}`, percent: 0.1 });
      try {
        const asset = await this.service.import(file);
        showProgress(progressId, { title: `Finalizing ${label}`, percent: 1 });
        window.setTimeout(() => hideProgress(progressId), 240);
        results.push(asset);
        showToast(`Imported ${label}`, 'success', 2400);
      } catch (err) {
        hideProgress(progressId);
        const detail = err?.message ? `: ${err.message}` : '';
        showToast(`Failed to import ${label}${detail}`, 'error', 3600);
        console.error('[Assets] Import failed', file, err);
      }
    }
    await this.refresh();
    return results;
  }

  async list() {
    const entries = await this.service.list();
    return entries;
  }

  copyPath(asset) {
    return this.service.getURI(asset);
  }

  async importGLTF(url) {
    if (!url) {
      return null;
    }
    if (!tryGetDevice()) {
      throw new Error('GPU device is not ready. Please wait for WebGPU initialization.');
    }
    const name = url.split('/').pop() || 'Asset';
    const progressId = `gltf:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`;
    showProgress(progressId, { title: `Importing ${name}`, percent: 0.1 });
    try {
      await this.import(url);
      showProgress(progressId, { title: `Importing ${name}`, percent: 0.45 });
      const result = await importGLTF(url, { name });
      showProgress(progressId, { title: `Finalizing ${name}`, percent: 1 });
      window.setTimeout(() => hideProgress(progressId), 240);
      showToast(`Imported ${name}`, 'success', 3200);
      console.info('[Assets] Imported glTF', url, result);
      return result;
    } catch (err) {
      hideProgress(progressId);
      const detail = err?.message ? `: ${err.message}` : '';
      showToast(`Failed to import ${name}${detail}`, 'error', 6200);
      throw err;
    }
  }

  async refresh() {
    try {
      const assets = await this.list();
      this.assets = assets;
      this._applyFilters();
    } catch (err) {
      console.error('[Assets] Failed to refresh', err);
    }
  }

  _createRoot() {
    const root = document.createElement('div');
    root.className = 'assets-pane';

    const toolbar = document.createElement('div');
    toolbar.className = 'assets-pane__toolbar';

    const left = document.createElement('div');
    left.className = 'assets-pane__toolbar-left';

    const importButton = document.createElement('button');
    importButton.type = 'button';
    importButton.textContent = 'Import…';
    left.appendChild(importButton);

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.style.display = 'none';
    importButton.addEventListener('click', () => {
      fileInput.value = '';
      fileInput.click();
    });
    fileInput.addEventListener('change', event => {
      const files = Array.from(event.target.files || []);
      if (files.length) {
        this.import(files);
      }
    });

    const filters = document.createElement('div');
    filters.className = 'assets-pane__filters';
    for (const entry of FILTERS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = entry.label;
      button.dataset.filter = entry.id;
      if (entry.id === this.filter) {
        button.classList.add('is-active');
      }
      button.addEventListener('click', () => {
        this.setFilter(entry.id);
      });
      filters.appendChild(button);
    }
    left.appendChild(filters);
    left.appendChild(fileInput);
    this._filtersElement = filters;

    const right = document.createElement('div');
    right.className = 'assets-pane__toolbar-right';

    const viewToggle = document.createElement('div');
    viewToggle.className = 'assets-pane__view-toggle';
    const gridButton = document.createElement('button');
    gridButton.type = 'button';
    gridButton.textContent = 'Grid';
    const listButton = document.createElement('button');
    listButton.type = 'button';
    listButton.textContent = 'List';
    const updateViewButtons = () => {
      gridButton.classList.toggle('is-active', this.viewMode === 'grid');
      listButton.classList.toggle('is-active', this.viewMode === 'list');
      this._applyViewMode();
    };
    gridButton.addEventListener('click', () => {
      this.viewMode = 'grid';
      updateViewButtons();
    });
    listButton.addEventListener('click', () => {
      this.viewMode = 'list';
      updateViewButtons();
    });
    viewToggle.append(gridButton, listButton);

    const searchWrap = document.createElement('div');
    searchWrap.className = 'assets-pane__search';
    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.placeholder = 'Search assets…';
    searchInput.addEventListener('input', () => {
      this.setSearch(searchInput.value);
    });
    searchInput.addEventListener('keydown', event => {
      if (event.key === 'Escape' && searchInput.value) {
        this.setSearch('');
        event.stopPropagation();
      }
    });
    searchWrap.appendChild(searchInput);
    this._searchInput = searchInput;

    right.append(viewToggle, searchWrap);
    toolbar.append(left, right);

    const content = document.createElement('div');
    content.className = 'assets-pane__content';

    const browser = document.createElement('div');
    browser.className = 'assets-browser';

    const items = document.createElement('div');
    items.className = 'assets-browser__items';
    browser.appendChild(items);

    const previewHost = document.createElement('aside');
    previewHost.className = 'assets-pane__preview';
    this.preview = new AssetPreview();
    previewHost.appendChild(this.preview.element);

    const footer = document.createElement('div');
    footer.className = 'assets-pane__footer';
    footer.textContent = 'Drag assets into the scene or material slots to assign.';

    content.append(browser, previewHost);
    root.append(toolbar, content, footer);

    this.importButton = importButton;
    this.fileInput = fileInput;
    this.itemsHost = items;
    this.browser = browser;
    this.footer = footer;

    updateViewButtons();

    return root;
  }

  setFilter(nextFilter = 'all') {
    const targetFilter = FILTERS.some(entry => entry.id === nextFilter) ? nextFilter : 'all';
    if (this.filter === targetFilter) {
      this._applyFilters();
      return;
    }
    this.filter = targetFilter;
    if (this._filtersElement) {
      for (const child of this._filtersElement.children) {
        child.classList.toggle('is-active', child.dataset.filter === targetFilter);
      }
    }
    this._applyFilters();
  }

  setSearch(value = '') {
    const normalized = (value ?? '').toString();
    const lower = normalized.trim().toLowerCase();
    if (this.searchQuery === lower) {
      if (normalized !== this._searchInput?.value) {
        if (this._searchInput) {
          this._searchInput.value = normalized;
        }
      }
      this._applyFilters();
      return;
    }
    this.searchQuery = lower;
    if (this._searchInput && this._searchInput.value !== normalized) {
      this._searchInput.value = normalized;
    }
    this._applyFilters();
  }

  _applyFilters() {
    this.filtered = this.assets
      .filter(asset => matchFilter(asset, this.filter))
      .filter(asset => matchSearch(asset, this.searchQuery))
      .sort((a, b) => normalizeName(a).localeCompare(normalizeName(b)));
    this._renderAssets();
  }

  _applyViewMode() {
    if (!this.itemsHost) return;
    this.itemsHost.classList.toggle('is-list', this.viewMode === 'list');
  }

  _renderAssets() {
    if (!this.itemsHost) return;
    this._applyViewMode();
    this.itemsHost.textContent = '';
    this._dragDisposers.forEach(dispose => dispose?.());
    this._dragDisposers.clear();

    if (!this.filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'assets-browser__empty';
      empty.textContent = this.searchQuery
        ? 'No assets match your search.'
        : 'Import files to populate your project assets.';
      this.itemsHost.appendChild(empty);
      this.preview?.setAsset(null);
      return;
    }

    const frag = document.createDocumentFragment();
    for (const asset of this.filtered) {
      const card = this._createCard(asset);
      frag.appendChild(card);
    }
    this.itemsHost.appendChild(frag);

    if (this.selection) {
      const selected = this.filtered.find(entry => entry.guid === this.selection.guid);
      if (selected) {
        this._selectAsset(selected, false);
      } else {
        this._selectAsset(this.filtered[0] ?? null, false);
      }
    } else {
      this._selectAsset(this.filtered[0] ?? null, false);
    }
  }

  _createCard(asset) {
    const card = document.createElement('div');
    card.className = 'asset-card';
    if (asset.guid) {
      card.dataset.guid = asset.guid;
    }

    const thumb = document.createElement('div');
    thumb.className = 'asset-card__thumb';
    const img = document.createElement('img');
    img.alt = '';
    if (asset.thumbnail) {
      img.src = asset.thumbnail;
    }
    thumb.appendChild(img);

    const meta = document.createElement('div');
    meta.className = 'asset-card__meta';
    const name = document.createElement('div');
    name.className = 'asset-card__name';
    name.textContent = normalizeName(asset);
    const type = document.createElement('div');
    type.className = 'asset-card__type';
    type.textContent = `${formatType(asset)} · ${formatStatus(asset)}`.trim();
    const path = document.createElement('div');
    path.className = 'asset-card__path';
    path.textContent = asset.logicalPath || '';
    meta.append(name, type, path);

    card.append(thumb, meta);

    card.addEventListener('click', event => {
      event.preventDefault();
      this._selectAsset(asset, true);
    });
    card.addEventListener('dblclick', () => {
      this._handleActivate(asset);
    });
    card.addEventListener('contextmenu', event => {
      showContextMenu(event, this._buildContextMenu(asset));
    });

    const dispose = registerDragSource(card, () => ({
      type: `asset/${asset.type || 'unknown'}`,
      kind: 'asset',
      guid: asset.guid,
      assetType: asset.type,
      name: normalizeName(asset),
      label: normalizeName(asset),
    }));
    if (asset.guid) {
      this._dragDisposers.set(asset.guid, dispose);
    }

    if (this.selection && this.selection.guid === asset.guid) {
      card.classList.add('is-selected');
    }

    return card;
  }

  _selectAsset(asset, focus = false) {
    this.selection = asset || null;
    if (this.preview) {
      this.preview.setAsset(asset || null);
    }
    if (!this.itemsHost) return;
    for (const child of this.itemsHost.children) {
      child.classList?.remove('is-selected');
    }
    if (asset?.guid) {
      const card = this.itemsHost.querySelector?.(`.asset-card[data-guid="${asset.guid}"]`);
      if (card) {
        card.classList.add('is-selected');
        if (focus) {
          card.scrollIntoView({ block: 'nearest' });
        }
      }
    }
  }

  _handleActivate(asset) {
    if (!asset) return;
    if (asset.type === 'models' && asset.source?.value) {
      this.importGLTF(asset.source.value).catch(err => {
        console.error('[Assets] Failed to activate model', err);
      });
    }
  }

  focusAsset(assetOrGuid, { openContextMenu = false } = {}) {
    const asset = typeof assetOrGuid === 'string'
      ? this.assets.find(entry => entry?.guid === assetOrGuid) ?? null
      : assetOrGuid || null;
    if (!asset) {
      return false;
    }
    if (!matchFilter(asset, this.filter)) {
      this.setFilter('all');
    } else {
      this._applyFilters();
    }
    if (this.searchQuery) {
      this.setSearch('');
    }
    if (this.hasDOM) {
      this._selectAsset(asset, true);
      if (openContextMenu) {
        window.requestAnimationFrame(() => {
          const card = this.itemsHost?.querySelector?.(`.asset-card[data-guid="${asset.guid}"]`);
          if (!card) return;
          const rect = card.getBoundingClientRect();
          const position = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          };
          const items = this._buildContextMenu(asset);
          if (items?.length) {
            showContextMenu(position, items);
          }
        });
      }
    } else {
      this.selection = asset;
    }
    return true;
  }

  getAssetEntries() {
    return Array.isArray(this.assets) ? [...this.assets] : [];
  }

  _buildContextMenu(asset) {
    const items = [];
    items.push({
      label: 'Reveal in Explorer',
      action: () => {
        this._revealAsset(asset);
      },
      disabled: asset?.type !== 'models',
    });
    items.push({
      label: 'Rename…',
      action: () => this._promptRename(asset),
    });
    items.push({
      label: 'Duplicate',
      action: () => this._duplicate(asset),
    });
    items.push({ type: 'separator' });
    items.push({
      label: 'Reimport…',
      action: () => this._promptReimport(asset),
    });
    items.push({
      label: 'Delete',
      action: () => this._delete(asset),
    });
    return items;
  }

  async _promptRename(asset) {
    if (!asset) return;
    const next = window.prompt('Rename asset', normalizeName(asset));
    if (!next || next === asset.name) return;
    await this.service.rename(asset.guid, next);
    await this.refresh();
  }

  async _duplicate(asset) {
    if (!asset) return;
    await this.service.duplicate(asset.guid);
    await this.refresh();
  }

  async _promptReimport(asset) {
    if (!asset) return;
    if (asset.source?.kind === 'path') {
      try {
        await this.service.reimport(asset.guid);
        const updated = await this.service.get(asset.guid);
        await this.materials.refreshAssignmentsForAsset(updated, guid => this.service.get(guid));
        await this.refresh();
        showToast(`Reimported ${normalizeName(asset)}`, 'success', 2200);
      } catch (err) {
        console.error('[Assets] Reimport failed', err);
        showToast(`Reimport failed: ${err.message}`, 'error', 3200);
      }
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '';
    input.style.display = 'none';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        await this.service.reimport(asset.guid, file);
        const updated = await this.service.get(asset.guid);
        await this.materials.refreshAssignmentsForAsset(updated, guid => this.service.get(guid));
        await this.refresh();
        showToast(`Reimported ${normalizeName(asset)}`, 'success', 2200);
      } catch (err) {
        console.error('[Assets] Reimport failed', err);
        showToast(`Reimport failed: ${err.message}`, 'error', 3200);
      }
    });
    document.body.appendChild(input);
    input.click();
    window.setTimeout(() => {
      if (input.parentElement) input.parentElement.removeChild(input);
    }, 0);
  }

  async _delete(asset) {
    if (!asset) return;
    const confirmed = window.confirm(`Delete ${normalizeName(asset)}? This cannot be undone.`);
    if (!confirmed) return;
    await this.service.remove(asset.guid);
    await this.refresh();
  }

  _revealAsset(asset) {
    if (!asset) return;
    console.info('[Assets] Reveal requested', asset);
    showToast('Reveal not implemented yet.', 'info', 2200);
  }

  _setupFloatingImport() {
    if (typeof document === 'undefined') {
      return;
    }
    if (document.getElementById('asset-import-panel')) {
      return;
    }

    const container = document.createElement('div');
    container.id = 'asset-import-panel';
    container.style.position = 'fixed';
    container.style.bottom = '16px';
    container.style.left = '16px';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '8px';
    container.style.padding = '12px';
    container.style.borderRadius = '12px';
    container.style.background = 'rgba(20, 20, 20, 0.8)';
    container.style.backdropFilter = 'blur(8px)';
    container.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.35)';
    container.style.zIndex = '1001';

    const button = document.createElement('button');
    button.textContent = 'Import glTF';
    button.style.border = 'none';
    button.style.padding = '8px 16px';
    button.style.borderRadius = '8px';
    button.style.background = '#3498db';
    button.style.color = '#fff';
    button.style.fontWeight = '600';
    button.style.cursor = 'pointer';

    button.addEventListener('click', async () => {
      const defaultPath = '/assets/sample/scene.gltf';
      const url = prompt('Enter glTF URL', defaultPath);
      if (!url) {
        return;
      }
      try {
        await this.importGLTF(url);
      } catch (err) {
        console.error('[Assets] Failed to import glTF', url, err);
      }
    });

    container.appendChild(button);
    document.body.appendChild(container);
  }
}
