import AssetService from '../services/assets.js';

// Basic Asset Manager pane providing import and listing features.
export default class AssetsPane {
  constructor(service = new AssetService()) {
    this.service = service;
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
}
