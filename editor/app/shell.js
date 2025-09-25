
import { DockArea, STORAGE_KEY as LAYOUT_STORAGE_KEY } from '../ui/dock/dock.js';
import { startPlay, stopPlay } from '../services/playmode.js';
import { CommandRegistry } from '../ui/commands.js';
import { Menubar } from '../ui/menubar.js';
import { HotkeyManager } from '../ui/hotkeys.js';
import StatusBar from '../ui/statusbar.js';
import { showToast } from '../ui/toast.js';

const THEME_STORAGE_KEY = 'axisforge.theme';

export const DEFAULT_LAYOUT = {
  type: 'split',
  direction: 'horizontal',
  sizes: [0.22, 0.78],
  children: [
    {
      type: 'stack',
      id: 'stack-explorer',
      tabs: ['explorer', 'assets'],
      active: 'explorer',
    },
    {
      type: 'split',
      direction: 'vertical',
      sizes: [0.68, 0.32],
      children: [
        {
          type: 'stack',
          id: 'stack-viewport',
          tabs: ['viewport'],
          active: 'viewport',
        },
        {
          type: 'split',
          direction: 'horizontal',
          sizes: [0.5, 0.5],
          children: [
            {
              type: 'stack',
              id: 'stack-console',
              tabs: ['console'],
              active: 'console',
            },
            {
              type: 'stack',
              id: 'stack-properties',
              tabs: ['properties'],
              active: 'properties',
            },
          ],
        },
      ],
    },
  ],
};

function countPanes(node) {
  if (!node) return 0;
  if (node.type === 'stack') {
    return node.tabs.length;
  }
  return node.children.reduce((total, child) => total + countPanes(child), 0);
}

function findStackForPane(node, paneId) {
  if (!node) return null;
  if (node.type === 'stack') {
    return node.tabs.includes(paneId) ? node.id : null;
  }
  for (const child of node.children) {
    const found = findStackForPane(child, paneId);
    if (found) return found;
  }
  return null;
}

export class EditorShell {
  constructor({ mount = document.body, selection = null, undo = null } = {}) {
    this.mount = mount;
    this.selection = selection;
    this.undo = undo;
    this.theme = this._loadTheme();
    this.playing = false;
    this._pendingPlay = false;
    this._pendingStop = false;
    this.settingsActive = false;
    this.toolMode = 'select';
    this.gridSnap = { enabled: false, size: 1, unit: 'm' };

    this.root = document.createElement('div');
    this.root.className = 'editor-shell';

    this.commands = new CommandRegistry();
    this._registerMenus();
    this.menubar = new Menubar(this.commands);
    this.hotkeys = new HotkeyManager(this.commands);

    this.toolbar = this._createToolbar();
    this.dockContainer = document.createElement('div');
    this.dockContainer.className = 'dock-area';
    this.statusbar = new StatusBar({ selection: this.selection, undo: this.undo });
    this.setToolMode(this.toolMode);
    this.setGridSnapState(this.gridSnap);

    this.root.append(this.menubar.element, this.toolbar, this.dockContainer, this.statusbar.element);
    this.mount.appendChild(this.root);

    this.dock = new DockArea(this.dockContainer, { storageKey: LAYOUT_STORAGE_KEY });
    const originalPersist = this.dock.persistLayout.bind(this.dock);
    this.dock.persistLayout = () => {
      originalPersist();
      this._updateLayoutInfo();
      this._setStatus('Layout saved', 'positive', 1200);
      this._syncViewCommands();
    };

    this._registerShellCommands();

    this._handleFullscreenChange = () => {
      this._syncWindowCommands();
    };
    document.addEventListener('fullscreenchange', this._handleFullscreenChange);

    this._applyTheme();
    this._setStatus('Ready');
    this._updateThemeIndicator();
    this._syncWindowCommands();
    this._syncPlayButtons();
  }

  registerPane(pane) {
    this.dock.registerPane(pane);
  }

  initializeLayout(layout = DEFAULT_LAYOUT) {
    this.dock.initialize(layout ?? DEFAULT_LAYOUT);
    this._updateLayoutInfo();
    this._syncViewCommands();
  }

  activatePane(paneId) {
    const stackId = findStackForPane(this.dock.layout, paneId);
    if (stackId) {
      this.dock.setActive(stackId, paneId);
      this._setStatus(`${paneId} focused`, 'positive', 1200);
    }
  }

  _registerMenus() {
    const menus = [
      { id: 'file', title: 'File', order: 10 },
      { id: 'edit', title: 'Edit', order: 20 },
      { id: 'view', title: 'View', order: 30 },
      { id: 'run', title: 'Run', order: 40 },
      { id: 'window', title: 'Window', order: 50 },
      { id: 'help', title: 'Help', order: 60 },
    ];
    for (const menu of menus) {
      this.commands.registerMenu(menu);
    }
  }

  _registerShellCommands() {
    if (!this.commands) return;

    // File menu
    this.commands.registerCommand({
      id: 'file.new',
      title: 'New',
      menu: 'file',
      order: 10,
      shortcut: ['Mod+N'],
      allowInInputs: true,
      run: () => {
        this._setStatus('New project coming soon', 'warning', 1800);
      },
    });
    this.commands.registerCommand({
      id: 'file.open',
      title: 'Open…',
      menu: 'file',
      order: 20,
      shortcut: ['Mod+O'],
      allowInInputs: true,
      run: () => {
        this._setStatus('Open project coming soon', 'warning', 1800);
      },
    });
    this.commands.registerCommand({
      id: 'file.save',
      title: 'Save',
      menu: 'file',
      order: 30,
      shortcut: ['Mod+S'],
      allowInInputs: true,
      run: () => {
        this._dispatchAction('axisforge:scene-save', 'Scene save requested');
      },
    });
    this.commands.registerCommand({
      id: 'file.saveAs',
      title: 'Save As…',
      menu: 'file',
      order: 40,
      shortcut: ['Shift+Mod+S'],
      allowInInputs: true,
      run: () => {
        this._setStatus('Save As coming soon', 'warning', 1800);
      },
    });
    this.commands.registerCommand({
      id: 'file.separator-exit',
      menu: 'file',
      type: 'separator',
      order: 90,
    });
    this.commands.registerCommand({
      id: 'file.exit',
      title: 'Exit',
      menu: 'file',
      order: 100,
      run: () => {
        this._setStatus('Exit coming soon', 'warning', 1800);
      },
    });

    // View menu
    this.commands.registerCommand({
      id: 'view.explorer',
      title: 'Explorer',
      menu: 'view',
      order: 10,
      type: 'command',
      checked: true,
      run: () => this._togglePanel('explorer', 'Explorer'),
    });
    this.commands.registerCommand({
      id: 'view.properties',
      title: 'Properties',
      menu: 'view',
      order: 20,
      type: 'command',
      checked: true,
      run: () => this._togglePanel('properties', 'Properties'),
    });
    this.commands.registerCommand({
      id: 'view.console',
      title: 'Console',
      menu: 'view',
      order: 30,
      type: 'command',
      checked: true,
      run: () => this._togglePanel('console', 'Console'),
    });
    this.commands.registerCommand({
      id: 'view.assets',
      title: 'Assets',
      menu: 'view',
      order: 40,
      type: 'command',
      checked: true,
      run: () => this._togglePanel('assets', 'Assets'),
    });
    this.commands.registerCommand({
      id: 'view.separator-reset',
      menu: 'view',
      type: 'separator',
      order: 80,
    });
    this.commands.registerCommand({
      id: 'view.resetLayout',
      title: 'Reset Layout',
      menu: 'view',
      order: 90,
      run: () => {
        this.dock.resetToDefault();
        this._setStatus('Layout reset', 'positive', 1600);
        this._syncViewCommands();
        this._updateLayoutInfo();
      },
    });

    // Run menu
    this.commands.registerCommand({
      id: 'run.play',
      title: 'Play',
      menu: 'run',
      order: 10,
      shortcut: ['F5'],
      allowInInputs: true,
      run: () => this._handlePlayClick(),
    });
    this.commands.registerCommand({
      id: 'run.stop',
      title: 'Stop',
      menu: 'run',
      order: 20,
      shortcut: ['Shift+F5'],
      allowInInputs: true,
      enabled: false,
      run: () => this._handleStopClick(),
    });

    // Window menu
    this.commands.registerCommand({
      id: 'window.themeToggle',
      title: 'Toggle Theme',
      menu: 'window',
      order: 10,
      shortcut: ['F6'],
      allowInInputs: true,
      checked: this.theme === 'light',
      run: () => this.toggleTheme(),
    });
    this.commands.registerCommand({
      id: 'window.highContrast',
      title: 'High Contrast',
      menu: 'window',
      order: 20,
      checked: this.settingsActive,
      run: () => this._toggleHighContrast(),
    });
    this.commands.registerCommand({
      id: 'window.fullscreen',
      title: 'Fullscreen',
      menu: 'window',
      order: 30,
      checked: Boolean(document.fullscreenElement),
      run: () => this._toggleFullscreen(),
    });

    // Help menu
    this.commands.registerCommand({
      id: 'help.about',
      title: 'About Axis Forge…',
      menu: 'help',
      order: 10,
      run: () => {
        this._setStatus('Axis Forge Editor v0.1', 'positive', 2000);
      },
    });
  }

  _syncViewCommands() {
    if (!this.commands || !this.dock) return;
    const mapping = [
      ['view.explorer', 'explorer'],
      ['view.properties', 'properties'],
      ['view.console', 'console'],
      ['view.assets', 'assets'],
    ];
    for (const [commandId, paneId] of mapping) {
      this.commands.setChecked(commandId, this.dock.isPaneVisible(paneId));
    }
  }

  _syncWindowCommands() {
    if (!this.commands) return;
    this.commands.setChecked('window.themeToggle', this.theme === 'light');
    this.commands.setChecked('window.highContrast', this.settingsActive);
    this.commands.setChecked('window.fullscreen', Boolean(document.fullscreenElement));
  }

  _togglePanel(paneId, label) {
    if (!this.dock) return;
    const visible = this.dock.togglePane(paneId);
    this._syncViewCommands();
    this._updateLayoutInfo();
    this._setStatus(`${label} ${visible ? 'shown' : 'hidden'}`, 'positive', 1600);
  }

  async _toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        this._setStatus('Fullscreen disabled', 'positive', 1600);
      } else {
        await document.documentElement.requestFullscreen();
        this._setStatus('Fullscreen enabled', 'positive', 1600);
      }
    } catch (err) {
      console.error('[Shell] Failed to toggle fullscreen', err);
      this._setStatus('Fullscreen unavailable', 'error', 2400);
    } finally {
      this._syncWindowCommands();
    }
  }

  _createToolbar() {
    const bar = document.createElement('div');
    bar.className = 'toolbar';

    const sectionPrimary = this._createToolbarSection();
    const sectionScene = this._createToolbarSection();
    const sectionUtility = this._createToolbarSection();

    this.playButton = this._createToolbarButton({
      label: 'Play',
      icon: 'icon--play',
      variant: 'primary',
      onClick: () => this._handlePlayClick(),
    });
    this.stopButton = this._createToolbarButton({
      label: 'Stop',
      icon: 'icon--stop',
      variant: 'danger',
      onClick: () => this._handleStopClick(),
      disabled: true,
    });

    const saveSceneButton = this._createToolbarButton({
      label: 'Save',
      icon: 'icon--save',
      onClick: () => this._dispatchAction('axisforge:scene-save', 'Scene save requested'),
    });
    const loadSceneButton = this._createToolbarButton({
      label: 'Load',
      icon: 'icon--folder',
      onClick: () => this._dispatchAction('axisforge:scene-load', 'Scene load requested'),
    });

    const importButton = this._createToolbarButton({
      label: 'Import glTF',
      icon: 'icon--upload',
      onClick: () => this._dispatchAction('axisforge:import-gltf', 'Import glTF…'),
    });

    this.settingsButton = this._createToolbarButton({
      label: 'Settings',
      icon: 'icon--settings',
      onClick: () => this._toggleHighContrast(),
    });
    this.settingsButton.setAttribute('aria-pressed', 'false');

    sectionPrimary.append(this.playButton, this.stopButton);
    sectionScene.append(saveSceneButton, loadSceneButton);
    sectionUtility.append(importButton, this.settingsButton);

    bar.append(sectionPrimary, sectionScene, sectionUtility);
    return bar;
  }

  _createToolbarSection() {
    const section = document.createElement('div');
    section.className = 'toolbar__section';
    return section;
  }

  setToolMode(mode) {
    if (!mode) return;
    this.toolMode = mode;
    this.statusbar?.setToolMode(mode);
  }

  setGridSnapState(options = {}) {
    if (!options || typeof options !== 'object') {
      this.statusbar?.setGridSnap(this.gridSnap);
      return;
    }
    const next = {
      enabled: options.enabled ?? this.gridSnap.enabled,
      size: typeof options.size === 'number' ? options.size : this.gridSnap.size,
      unit: options.unit || this.gridSnap.unit,
    };
    this.gridSnap = next;
    this.statusbar?.setGridSnap(next);
  }

  _createToolbarButton({ label, icon, variant, onClick, disabled = false }) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'toolbar__button';
    if (variant === 'primary') button.classList.add('toolbar__button--primary');
    if (variant === 'danger') button.classList.add('toolbar__button--danger');
    if (icon) {
      const iconEl = document.createElement('span');
      iconEl.className = `icon ${icon}`;
      button.appendChild(iconEl);
    }
    if (label) {
      const labelEl = document.createElement('span');
      labelEl.className = 'toolbar__button-label';
      labelEl.textContent = label;
      button.appendChild(labelEl);
    }
    if (onClick) {
      button.addEventListener('click', onClick);
    }
    button.disabled = disabled;
    return button;
  }

  _dispatchAction(eventName, statusMessage) {
    this.root.dispatchEvent(new CustomEvent(eventName, { bubbles: true }));
    this._setStatus(statusMessage, 'positive', 1200);
  }

  async _handlePlayClick() {
    if (this.playing || this._pendingPlay) return;
    this._pendingPlay = true;
    this._setStatus('Starting play mode…', 'positive');
    this._syncPlayButtons();
    try {
      await startPlay();
      this.playing = true;
      this._setStatus('Play mode running', 'positive', 2000);
    } catch (err) {
      console.error('[Shell] Failed to start play mode', err);
      this._setStatus('Play failed', 'error', 4000);
    } finally {
      this._pendingPlay = false;
      this._syncPlayButtons();
    }
  }

  async _handleStopClick() {
    if (!this.playing || this._pendingStop) return;
    this._pendingStop = true;
    this._setStatus('Stopping play mode…', 'warning');
    this._syncPlayButtons();
    try {
      await stopPlay();
      this.playing = false;
      this._setStatus('Editor mode', 'positive', 2000);
    } catch (err) {
      console.error('[Shell] Failed to stop play mode', err);
      this._setStatus('Stop failed', 'error', 4000);
    } finally {
      this._pendingStop = false;
      this._syncPlayButtons();
    }
  }

  _syncPlayButtons() {
    if (!this.playButton || !this.stopButton) return;
    this.playButton.disabled = this.playing || this._pendingPlay;
    this.stopButton.disabled = !this.playing || this._pendingStop;
    this.playButton.classList.toggle('is-active', this.playing);
    this.stopButton.classList.toggle('is-active', this.playing);
    if (this.commands) {
      this.commands.setEnabled('run.play', !this.playing && !this._pendingPlay);
      this.commands.setEnabled('run.stop', this.playing && !this._pendingStop);
    }
  }

  _toggleHighContrast() {
    this.settingsActive = !this.settingsActive;
    document.documentElement.classList.toggle('hc', this.settingsActive);
    this.settingsButton.classList.toggle('is-active', this.settingsActive);
    this.settingsButton.setAttribute('aria-pressed', String(this.settingsActive));
    this._setStatus(this.settingsActive ? 'High contrast enabled' : 'High contrast disabled', 'positive', 2000);
    this._syncWindowCommands();
  }

  toggleTheme() {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
    this._applyTheme();
    this._saveTheme();
    this._updateThemeIndicator();
    this._setStatus(`${this.theme.charAt(0).toUpperCase() + this.theme.slice(1)} theme`, 'positive', 1600);
    this._syncWindowCommands();
  }

  _applyTheme() {
    const root = document.documentElement;
    if (this.theme === 'light') {
      root.setAttribute('data-theme', 'light');
    } else {
      root.removeAttribute('data-theme');
    }
  }

  _loadTheme() {
    if (typeof localStorage === 'undefined') return 'dark';
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      return stored === 'light' ? 'light' : 'dark';
    } catch (err) {
      console.warn('[Shell] Failed to load theme preference', err);
      return 'dark';
    }
  }

  _saveTheme() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, this.theme);
    } catch (err) {
      console.warn('[Shell] Failed to store theme preference', err);
    }
  }

  _updateThemeIndicator() {
    this.statusbar?.setTheme?.(this.theme);
  }

  _updateLayoutInfo() {
    if (!this.dock) return;
    const count = countPanes(this.dock.layout);
    const summary = `${count} pane${count === 1 ? '' : 's'}`;
    this.statusbar?.setLayoutSummary?.(summary);
  }

  _setStatus(message, tone = 'normal', duration = 0) {
    if (!message) return;
    if (message === 'Ready' && tone === 'normal') {
      return;
    }
    const typeMap = {
      positive: 'success',
      warning: 'warn',
      error: 'error',
    };
    const toastType = typeMap[tone] ?? 'info';
    showToast(message, toastType, duration);
  }
}
