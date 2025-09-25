import AssetService from '../services/assets.js';
import importGLTF from '../../engine/asset/gltf/importer.js';
import { getWorkspace } from '../../engine/scene/workspace.js';
import { tryGetDevice } from '../../engine/render/gpu/device.js';
import { showToast } from '../ui/toast.js';
import { showProgress, hideProgress } from '../ui/progress.js';

// Basic Asset Manager pane providing import and listing features.
export default class AssetsPane {
  constructor(service = new AssetService(), options = {}) {
    this.service = service;
    this.workspace = getWorkspace();
    const { floatingUI = true } = options ?? {};
    if (floatingUI) {
      this._setupUI();
    }
  }

  // Import an array of File objects or paths.
  async import(files) {
    const arr = Array.isArray(files) ? files : [files];
    for (const file of arr) {
      await this.service.import(file);
    }
    return this.list();
  }

  // Retrieve list of assets with status information.
  async list() {
    return await this.service.list();
  }

  // Get a logical URI for an asset suitable for runtime resolution.
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

  _setupUI() {
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
