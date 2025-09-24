import drawList from '../mesh/drawList.js';
import { extractFrustumPlanes, isAABBVisible } from './culling.js';
import { setMeshInstanceStats } from '../framegraph/stats.js';

class RenderList {
  constructor() {
    this._visible = [];
    this._frustumPlanes = null;
    this._stats = {
      total: 0,
      visible: 0,
      culled: 0,
    };
  }

  update(cameraInfo = null) {
    const instances = drawList.getInstances();
    const total = instances.length;

    this._visible.length = 0;
    this._stats.total = total;
    this._stats.culled = 0;
    this._stats.visible = 0;

    if (total === 0) {
      setMeshInstanceStats({ total: 0, visible: 0, culled: 0 });
      this._frustumPlanes = null;
      return this._visible;
    }

    const viewProjection = cameraInfo?.viewProjection;
    this._frustumPlanes = viewProjection ? extractFrustumPlanes(viewProjection) : null;

    if (!this._frustumPlanes) {
      this._visible.push(...instances);
      this._stats.visible = total;
      setMeshInstanceStats({ total, visible: total, culled: 0 });
      return this._visible;
    }

    for (const instance of instances) {
      if (!instance) {
        continue;
      }
      const bounds = typeof instance.getWorldBounds === 'function'
        ? instance.getWorldBounds()
        : null;
      if (!bounds || isAABBVisible(bounds, this._frustumPlanes)) {
        this._visible.push(instance);
      }
    }

    const visibleCount = this._visible.length;
    const culledCount = Math.max(0, total - visibleCount);

    this._stats.visible = visibleCount;
    this._stats.culled = culledCount;

    setMeshInstanceStats({
      total,
      visible: visibleCount,
      culled: culledCount,
    });

    return this._visible;
  }

  getVisibleInstances() {
    return this._visible;
  }

  getStats() {
    return { ...this._stats };
  }

  getFrustumPlanes() {
    return this._frustumPlanes;
  }
}

const renderList = new RenderList();

export default renderList;
