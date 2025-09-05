import ExplorerPanel from './Panels/ExplorerPanel.js';
import PropertiesPanel from './Panels/PropertiesPanel.js';
import ViewportPanel from './Panels/ViewportPanel.js';
import ConsolePanel from './Panels/ConsolePanel.js';

/**
 * Editor application shell. Creates the primary dockable layout consisting of
 * Explorer, Properties, Viewport and Console panels. Panel sizes are
 * persistent via localStorage so the layout restores when the editor is
 * reloaded.
 */
export default class AppShell {
  constructor(container = document.body) {
    this.container = container;
    this.layoutKey = 'editor-layout';

    const saved = this.#loadLayout();
    this.leftWidth = saved.leftWidth ?? 200;
    this.rightWidth = saved.rightWidth ?? 250;
    this.bottomHeight = saved.bottomHeight ?? 150;

    this.#build();
    this.#saveLayout();
  }

  /** Build DOM structure */
  #build() {
    this.root = document.createElement('div');
    this.root.id = 'editor-app';
    this.root.style.display = 'flex';
    this.root.style.height = '100vh';
    this.container.appendChild(this.root);

    // Explorer
    this.explorerEl = document.createElement('div');
    this.explorerEl.id = 'explorer';
    this.explorerEl.style.width = this.leftWidth + 'px';
    this.explorerEl.style.overflow = 'auto';
    this.root.appendChild(this.explorerEl);

    // Left resizer
    this.leftResizer = document.createElement('div');
    this.leftResizer.className = 'v-resizer';
    this.root.appendChild(this.leftResizer);

    // Center container (viewport + console)
    this.center = document.createElement('div');
    this.center.style.flex = '1';
    this.center.style.display = 'flex';
    this.center.style.flexDirection = 'column';
    this.root.appendChild(this.center);

    // Viewport panel
    this.viewportEl = document.createElement('div');
    this.viewportEl.id = 'viewport';
    this.viewportEl.style.flex = '1';
    this.viewportEl.style.overflow = 'hidden';
    this.center.appendChild(this.viewportEl);

    // Horizontal resizer
    this.bottomResizer = document.createElement('div');
    this.bottomResizer.className = 'h-resizer';
    this.center.appendChild(this.bottomResizer);

    // Console panel
    this.consoleEl = document.createElement('div');
    this.consoleEl.id = 'console';
    this.consoleEl.style.height = this.bottomHeight + 'px';
    this.consoleEl.style.overflow = 'auto';
    this.center.appendChild(this.consoleEl);

    // Right resizer
    this.rightResizer = document.createElement('div');
    this.rightResizer.className = 'v-resizer';
    this.root.appendChild(this.rightResizer);

    // Properties
    this.propertiesEl = document.createElement('div');
    this.propertiesEl.id = 'properties';
    this.propertiesEl.style.width = this.rightWidth + 'px';
    this.propertiesEl.style.overflow = 'auto';
    this.root.appendChild(this.propertiesEl);

    // Panels
    const instances = ExplorerPanel.createDefaultInstances();
    this.explorer = new ExplorerPanel(this.explorerEl, instances);
    this.properties = new PropertiesPanel(this.propertiesEl);
    this.viewport = new ViewportPanel(this.viewportEl);
    this.console = new ConsolePanel(this.consoleEl);

    // Selection hookup
    this.explorer.onSelect(instance => {
      this.properties.setInstance(instance);
    });

    // Resizers
    this.#setupResizers();
  }

  /** Configure mouse-driven resizers */
  #setupResizers() {
    // Left vertical resizer
    this.#drag(this.leftResizer, 'col', dx => {
      this.leftWidth = Math.max(100, this.leftWidth + dx);
      this.explorerEl.style.width = this.leftWidth + 'px';
      this.#saveLayout();
    });

    // Right vertical resizer
    this.#drag(this.rightResizer, 'col', dx => {
      this.rightWidth = Math.max(100, this.rightWidth - dx);
      this.propertiesEl.style.width = this.rightWidth + 'px';
      this.#saveLayout();
    });

    // Bottom horizontal resizer
    this.#drag(this.bottomResizer, 'row', dy => {
      this.bottomHeight = Math.max(80, this.bottomHeight - dy);
      this.consoleEl.style.height = this.bottomHeight + 'px';
      this.#saveLayout();
    });
  }

  /** Utility to handle dragging of resizer elements */
  #drag(el, dir, onMove) {
    el.addEventListener('mousedown', e => {
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const move = ev => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        onMove(dir === 'col' ? dx : dy);
      };
      const up = () => {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    });
  }

  #loadLayout() {
    try {
      const raw = localStorage.getItem(this.layoutKey);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  #saveLayout() {
    const data = {
      leftWidth: this.leftWidth,
      rightWidth: this.rightWidth,
      bottomHeight: this.bottomHeight
    };
    try {
      localStorage.setItem(this.layoutKey, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }
}

// basic styles for resizers
const style = document.createElement('style');
style.textContent = `
#editor-app { font-family: sans-serif; }
.v-resizer { width: 5px; cursor: col-resize; background: #ddd; }
.h-resizer { height: 5px; cursor: row-resize; background: #ddd; }
.panel-title { font-weight: bold; padding: 4px; border-bottom: 1px solid #ccc; }
.panel-body { padding: 4px; }
`;
document.head.appendChild(style);
