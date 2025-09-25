import { getFrameStats } from '../../engine/render/framegraph/stats.js';

const TOOL_LABELS = {
  select: 'Select',
  move: 'Move',
  rotate: 'Rotate',
  scale: 'Scale',
};

function createItem(label, value = '') {
  const item = document.createElement('div');
  item.className = 'statusbar__item';

  const labelEl = document.createElement('span');
  labelEl.className = 'statusbar__item-label';
  labelEl.textContent = label;

  const valueEl = document.createElement('span');
  valueEl.className = 'statusbar__item-value';
  valueEl.textContent = value;

  item.append(labelEl, valueEl);
  return { item, valueEl };
}

function formatNumber(value, digits = 0) {
  if (!Number.isFinite(value)) {
    return '0';
  }
  if (digits > 0) {
    return value.toFixed(digits);
  }
  return Math.round(value).toString();
}

export default class StatusBar {
  constructor({ selection, undo } = {}) {
    this.selection = selection;
    this.undo = undo;

    this.element = document.createElement('footer');
    this.element.className = 'statusbar';

    this.leftSection = document.createElement('div');
    this.leftSection.className = 'statusbar__section statusbar__section--left';

    this.centerSection = document.createElement('div');
    this.centerSection.className = 'statusbar__section statusbar__section--center';

    this.rightSection = document.createElement('div');
    this.rightSection.className = 'statusbar__section statusbar__section--right';

    const selectionItem = createItem('Selection', '0');
    this.selectionValue = selectionItem.valueEl;

    const toolItem = createItem('Tool', TOOL_LABELS.select);
    this.toolValue = toolItem.valueEl;

    const gridItem = createItem('Grid', 'Snap Off');
    this.gridValue = gridItem.valueEl;

    this.leftSection.append(selectionItem.item, toolItem.item, gridItem.item);

    const instancesItem = createItem('Instances', '0');
    this.instancesValue = instancesItem.valueEl;

    const meshesItem = createItem('Meshes', '0');
    this.meshesValue = meshesItem.valueEl;

    const drawCallsItem = createItem('Draw Calls', '0');
    this.drawCallsValue = drawCallsItem.valueEl;

    this.centerSection.append(instancesItem.item, meshesItem.item, drawCallsItem.item);

    const gpuItem = createItem('GPU', 'Detecting…');
    this.gpuValue = gpuItem.valueEl;

    const fpsItem = createItem('FPS', '0');
    fpsItem.item.classList.add('statusbar__item--numeric');
    this.fpsValue = fpsItem.valueEl;

    const projectItem = createItem('Project', 'Saved');
    this.projectValue = projectItem.valueEl;
    this.projectDot = document.createElement('span');
    this.projectDot.className = 'statusbar__dirty-dot';
    this.projectDot.textContent = '•';
    projectItem.item.insertBefore(this.projectDot, projectItem.valueEl);
    this.setProjectDirty(false);

    const branchItem = createItem('Git', '—');
    this.branchValue = branchItem.valueEl;

    this.rightSection.append(gpuItem.item, fpsItem.item, projectItem.item, branchItem.item);

    this.element.append(this.leftSection, this.centerSection, this.rightSection);

    this._fpsSmoothing = 0;

    this._updateStats = this._updateStats.bind(this);
    this._rafId = requestAnimationFrame(this._updateStats);

    this._selectionConn = null;
    if (this.selection?.Changed) {
      const readSelection = () => {
        try {
          if (typeof this.selection.get === 'function') {
            return this.selection.get();
          }
          if (typeof this.selection.getSelection === 'function') {
            return this.selection.getSelection();
          }
        } catch (err) {
          console.warn('[StatusBar] Failed to read selection', err);
        }
        return [];
      };
      const updateSelection = sel => {
        const count = Array.isArray(sel) ? sel.length : 0;
        this.setSelectionCount(count);
      };
      updateSelection(readSelection());
      this._selectionConn = this.selection.Changed.Connect(updateSelection);
    }

    if (this.undo) {
      this.setProjectDirty(this.undo.undoStack?.length > 0);
    }

    this._fetchGitInfo();
  }

  dispose() {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    if (this._selectionConn) {
      this._selectionConn.Disconnect();
      this._selectionConn = null;
    }
  }

  setSelectionCount(count = 0) {
    const value = Number.isFinite(count) ? count : 0;
    this.selectionValue.textContent = value === 1 ? '1 item' : `${value} items`;
  }

  setToolMode(mode = 'select') {
    const label = TOOL_LABELS[mode] ?? mode;
    this.toolValue.textContent = label;
  }

  setGridSnap({ enabled = false, size = 1, unit = 'm' } = {}) {
    if (!enabled) {
      this.gridValue.textContent = 'Snap Off';
      return;
    }
    const formatted = typeof size === 'number' ? `${size.toFixed(size >= 1 ? 1 : 2)}${unit}` : size;
    this.gridValue.textContent = `Snap ${formatted}`;
  }

  setSceneStats({ instances = 0, meshes = 0, drawCalls = 0 } = {}) {
    this.instancesValue.textContent = formatNumber(instances);
    this.meshesValue.textContent = formatNumber(meshes);
    this.drawCallsValue.textContent = formatNumber(drawCalls);
  }

  setGpuName(name) {
    const text = name || 'Unavailable';
    this.gpuValue.textContent = text;
    this.gpuValue.title = text;
  }

  setFps(value) {
    if (!Number.isFinite(value) || value <= 0) {
      this._fpsSmoothing = 0;
      this.fpsValue.textContent = '0.0';
      return;
    }
    const smoothed = (this._fpsSmoothing * 0.85) + (value * 0.15);
    this._fpsSmoothing = smoothed;
    this.fpsValue.textContent = smoothed.toFixed(1);
  }

  setProjectDirty(isDirty) {
    const dirty = Boolean(isDirty);
    this.projectValue.textContent = dirty ? 'Unsaved Changes' : 'Saved';
    this.projectDot.classList.toggle('is-active', dirty);
    this.projectDot.setAttribute('aria-hidden', dirty ? 'false' : 'true');
  }

  setGitBranch(branch) {
    const text = branch || '—';
    this.branchValue.textContent = text;
    this.branchValue.title = text;
  }

  setTheme(theme) {
    // Optional: expose current theme for other components.
    this.element.dataset.theme = theme || '';
  }

  setLayoutSummary(summary) {
    this.element.dataset.layout = summary || '';
  }

  _updateStats() {
    const stats = getFrameStats?.();
    if (stats) {
      const meshStats = stats.meshInstances || {};
      const instances = typeof meshStats.total === 'number' ? meshStats.total : 0;
      const meshes = typeof meshStats.visible === 'number' ? meshStats.visible : 0;
      const drawCalls = typeof stats.totalDrawCalls === 'number' ? stats.totalDrawCalls : 0;
      this.setSceneStats({ instances, meshes, drawCalls });
      this.setGpuName(stats.gpuAdapterName || 'Detecting…');
      const fps = Number.isFinite(stats.fps) ? stats.fps : 0;
      this.setFps(fps);
    }
    this._rafId = requestAnimationFrame(this._updateStats);
  }

  async _fetchGitInfo() {
    if (typeof fetch !== 'function') {
      return;
    }
    try {
      if (typeof window !== 'undefined' && window.__AXISFORGE_GIT_BRANCH__) {
        this.setGitBranch(window.__AXISFORGE_GIT_BRANCH__);
        return;
      }
      const response = await fetch('/git-info.json', { cache: 'no-store' });
      if (!response.ok) {
        this.setGitBranch('—');
        return;
      }
      const data = await response.json();
      if (data?.branch) {
        this.setGitBranch(data.branch);
      } else {
        this.setGitBranch('—');
      }
    } catch (err) {
      console.warn('[StatusBar] Unable to load git info', err);
      this.setGitBranch('—');
    }
  }
}
