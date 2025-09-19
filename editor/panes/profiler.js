import { getFrameStats } from '../../engine/render/framegraph/stats.js';

function createStatRow(label) {
  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.justifyContent = 'space-between';
  row.style.alignItems = 'center';
  row.style.gap = '12px';

  const labelEl = document.createElement('span');
  labelEl.textContent = label;
  labelEl.style.opacity = '0.75';

  const valueEl = document.createElement('span');
  valueEl.style.fontVariantNumeric = 'tabular-nums';

  row.appendChild(labelEl);
  row.appendChild(valueEl);

  return { row, valueEl };
}

export default class ProfilerPane {
  constructor() {
    this.enabled = true;
    this.latestStats = null;
    this.passRows = new Map();

    this.root = document.createElement('div');
    this.root.id = 'profiler-pane';
    this.root.style.position = 'fixed';
    this.root.style.bottom = '12px';
    this.root.style.left = '12px';
    this.root.style.background = 'rgba(20, 20, 20, 0.85)';
    this.root.style.color = '#fff';
    this.root.style.padding = '12px';
    this.root.style.borderRadius = '6px';
    this.root.style.fontFamily = 'monospace';
    this.root.style.fontSize = '12px';
    this.root.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
    this.root.style.minWidth = '180px';
    this.root.style.pointerEvents = 'none';
    this.root.style.userSelect = 'none';
    this.root.style.lineHeight = '1.4';

    const title = document.createElement('div');
    title.textContent = 'Profiler';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '8px';
    this.root.appendChild(title);

    const fpsRow = createStatRow('FPS');
    this.fpsValue = fpsRow.valueEl;
    this.root.appendChild(fpsRow.row);

    const frameTimeRow = createStatRow('CPU Frame (ms)');
    this.frameTimeValue = frameTimeRow.valueEl;
    this.root.appendChild(frameTimeRow.row);

    const gpuRow = createStatRow('GPU');
    this.gpuValue = gpuRow.valueEl;
    this.root.appendChild(gpuRow.row);

    const totalDrawRow = createStatRow('Draw Calls');
    this.totalDrawValue = totalDrawRow.valueEl;
    this.root.appendChild(totalDrawRow.row);

    const divider = document.createElement('div');
    divider.style.height = '1px';
    divider.style.background = 'rgba(255, 255, 255, 0.1)';
    divider.style.margin = '8px 0';
    this.root.appendChild(divider);

    const passTitle = document.createElement('div');
    passTitle.textContent = 'Passes';
    passTitle.style.opacity = '0.75';
    passTitle.style.marginBottom = '4px';
    this.root.appendChild(passTitle);

    this.drawCallsContainer = document.createElement('div');
    this.drawCallsContainer.style.display = 'flex';
    this.drawCallsContainer.style.flexDirection = 'column';
    this.drawCallsContainer.style.gap = '2px';
    this.root.appendChild(this.drawCallsContainer);

    document.body.appendChild(this.root);

    this._update = this._update.bind(this);
    requestAnimationFrame(this._update);
  }

  isVisible() {
    return this.enabled;
  }

  setVisible(visible) {
    this.enabled = Boolean(visible);
    this.root.style.display = this.enabled ? 'block' : 'none';
    if (this.enabled && this.latestStats) {
      this._render(this.latestStats);
    }
  }

  _update() {
    this.latestStats = getFrameStats();
    if (this.enabled) {
      this._render(this.latestStats);
    }
    requestAnimationFrame(this._update);
  }

  _render(stats) {
    const fps = Number.isFinite(stats.fps) ? stats.fps : 0;
    const frameTime = Number.isFinite(stats.cpuFrameTime) ? stats.cpuFrameTime : 0;
    const totalDrawCalls = typeof stats.totalDrawCalls === 'number' ? stats.totalDrawCalls : 0;

    this.fpsValue.textContent = fps.toFixed(1);
    this.frameTimeValue.textContent = frameTime.toFixed(2);
    this.gpuValue.textContent = stats.gpuAdapterName || 'Detecting…';
    this.totalDrawValue.textContent = totalDrawCalls.toString();

    this._syncPassRows(stats.passes || {});
  }

  _syncPassRows(passes) {
    const seen = new Set();
    for (const name of Object.keys(passes)) {
      seen.add(name);
      let entry = this.passRows.get(name);
      if (!entry) {
        const { row, valueEl } = createStatRow(name);
        row.style.paddingLeft = '4px';
        valueEl.style.fontVariantNumeric = 'tabular-nums';
        entry = { row, valueEl };
        this.passRows.set(name, entry);
        this.drawCallsContainer.appendChild(row);
      }
      entry.valueEl.textContent = passes[name].drawCalls.toString();
    }

    for (const [name, entry] of this.passRows.entries()) {
      if (!seen.has(name)) {
        entry.row.remove();
        this.passRows.delete(name);
      }
    }
  }
}
