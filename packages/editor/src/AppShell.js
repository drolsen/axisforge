import ExplorerPanel from './Panels/ExplorerPanel.js';
import PropertiesPanel from './Panels/PropertiesPanel.js';
import ViewportPanel from './Panels/ViewportPanel.js';
import ConsolePanel from './Panels/ConsolePanel.js';

const LAYOUT_KEY = 'axisforge-editor-layout';

export default function init(root = document.body) {
  return new AppShell(root);
}

export class AppShell {
  constructor(root = document.body) {
    this.root = root;
    this.layout = this._loadLayout();
    this.zones = this._createShell();
    this.panels = {};
    this._createPanels();
    window.appShell = this; // expose for tests
  }

  _createShell() {
    const style = document.createElement('style');
    style.textContent = `
      #app-shell {
        display: grid;
        grid-template-columns: 20% auto 20%;
        grid-template-rows: 1fr 25%;
        height: 100vh;
      }
      .zone { overflow: auto; }
      .zone.left { grid-column:1; grid-row:1/2; }
      .zone.center { grid-column:2; grid-row:1/2; }
      .zone.right { grid-column:3; grid-row:1/2; }
      .zone.bottom { grid-column:1/4; grid-row:2/3; }
      .panel { border:1px solid #666; display:flex; flex-direction:column; height:100%; }
      .panel-header { background:#ddd; padding:4px; font-weight:bold; display:flex; justify-content:space-between; }
      .panel-body { flex:1; padding:4px; }
    `;
    document.head.appendChild(style);

    const shell = document.createElement('div');
    shell.id = 'app-shell';
    this.root.appendChild(shell);

    const zones = {
      left: document.createElement('div'),
      center: document.createElement('div'),
      right: document.createElement('div'),
      bottom: document.createElement('div'),
    };
    Object.entries(zones).forEach(([k, el]) => {
      el.className = `zone ${k}`;
      shell.appendChild(el);
    });
    return zones;
  }

  _createPanels() {
    this.panels = {
      explorer: ExplorerPanel(),
      viewport: ViewportPanel(),
      properties: PropertiesPanel(),
      console: ConsolePanel(),
    };
    for (const id of Object.keys(this.panels)) {
      const zone = this.layout[id];
      this.movePanel(id, zone, false);
      this._addMoveButton(this.panels[id], id);
    }
    this._saveLayout();
  }

  _addMoveButton(panelEl, id) {
    const btn = document.createElement('button');
    btn.textContent = 'Move';
    btn.addEventListener('click', () => {
      const zones = Object.keys(this.zones);
      const current = zones.indexOf(this.layout[id]);
      const next = zones[(current + 1) % zones.length];
      this.movePanel(id, next);
    });
    const header = panelEl.querySelector('.panel-header');
    header.appendChild(btn);
  }

  movePanel(id, zone, save = true) {
    const panel = this.panels[id];
    const target = this.zones[zone];
    if (!panel || !target) return;
    target.appendChild(panel);
    this.layout[id] = zone;
    if (save) this._saveLayout();
  }

  _loadLayout() {
    try {
      const data = JSON.parse(localStorage.getItem(LAYOUT_KEY));
      if (data) return data;
    } catch (e) {
      /* ignore */
    }
    return { explorer: 'left', viewport: 'center', properties: 'right', console: 'bottom' };
  }

  _saveLayout() {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(this.layout));
  }
}
