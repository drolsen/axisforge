
import { DockArea, STORAGE_KEY as LAYOUT_STORAGE_KEY } from '../ui/dock/dock.js';
import { startPlay, stopPlay } from '../services/playmode.js';

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
  constructor({ mount = document.body } = {}) {
    this.mount = mount;
    this.theme = this._loadTheme();
    this.playing = false;
    this._pendingPlay = false;
    this._pendingStop = false;
    this.settingsActive = false;
    this.statusTimer = null;

    this.root = document.createElement('div');
    this.root.className = 'editor-shell';

    this.menubar = this._createMenubar();
    this.toolbar = this._createToolbar();
    this.dockContainer = document.createElement('div');
    this.dockContainer.className = 'dock-area';
    this.statusbar = this._createStatusbar();

    this.root.append(this.menubar, this.toolbar, this.dockContainer, this.statusbar);
    this.mount.appendChild(this.root);

    this.dock = new DockArea(this.dockContainer, { storageKey: LAYOUT_STORAGE_KEY });
    const originalPersist = this.dock.persistLayout.bind(this.dock);
    this.dock.persistLayout = () => {
      originalPersist();
      this._updateLayoutInfo();
      this._setStatus('Layout saved', 'positive', 1200);
    };

    this._applyTheme();
    this._setStatus('Ready');
    this._updateThemeIndicator();
    this._syncPlayButtons();

    this._keyHandler = this._handleKeyDown.bind(this);
    window.addEventListener('keydown', this._keyHandler);
  }

  registerPane(pane) {
    this.dock.registerPane(pane);
  }

  initializeLayout(layout = DEFAULT_LAYOUT) {
    this.dock.initialize(layout ?? DEFAULT_LAYOUT);
    this._updateLayoutInfo();
  }

  activatePane(paneId) {
    const stackId = findStackForPane(this.dock.layout, paneId);
    if (stackId) {
      this.dock.setActive(stackId, paneId);
      this._setStatus(`${paneId} focused`, 'positive', 1200);
    }
  }

  _createMenubar() {
    const menu = document.createElement('nav');
    menu.className = 'menubar';
    const entries = ['File', 'Edit', 'View', 'Run', 'Window', 'Help'];
    for (const label of entries) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'menubar__item';
      button.textContent = label;
      button.title = `${label} menu (coming soon)`;
      menu.appendChild(button);
    }
    return menu;
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

  _createStatusbar() {
    const bar = document.createElement('footer');
    bar.className = 'statusbar';

    const left = document.createElement('div');
    left.className = 'statusbar__section';
    const right = document.createElement('div');
    right.className = 'statusbar__section';

    this.statusItem = document.createElement('span');
    this.statusItem.className = 'statusbar__item';
    const statusLabel = document.createElement('strong');
    statusLabel.textContent = 'Status';
    this.statusValue = document.createElement('span');
    this.statusValue.textContent = 'Ready';
    this.statusItem.append(statusLabel, this.statusValue);

    const hint = document.createElement('span');
    hint.className = 'statusbar__item hint';
    hint.textContent = 'F6 toggles theme';

    this.themeItem = document.createElement('span');
    this.themeItem.className = 'statusbar__item';
    const themeLabel = document.createElement('strong');
    themeLabel.textContent = 'Theme';
    this.themeValue = document.createElement('span');
    this.themeItem.append(themeLabel, this.themeValue);

    this.layoutItem = document.createElement('span');
    this.layoutItem.className = 'statusbar__item';
    const layoutLabel = document.createElement('strong');
    layoutLabel.textContent = 'Layout';
    this.layoutValue = document.createElement('span');
    this.layoutItem.append(layoutLabel, this.layoutValue);

    left.append(this.statusItem, hint);
    right.append(this.themeItem, this.layoutItem);
    bar.append(left, right);
    return bar;
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
  }

  _toggleHighContrast() {
    this.settingsActive = !this.settingsActive;
    document.documentElement.classList.toggle('hc', this.settingsActive);
    this.settingsButton.classList.toggle('is-active', this.settingsActive);
    this.settingsButton.setAttribute('aria-pressed', String(this.settingsActive));
    this._setStatus(this.settingsActive ? 'High contrast enabled' : 'High contrast disabled', 'positive', 2000);
  }

  _handleKeyDown(event) {
    if (event.key === 'F6') {
      event.preventDefault();
      this.toggleTheme();
    }
  }

  toggleTheme() {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
    this._applyTheme();
    this._saveTheme();
    this._updateThemeIndicator();
    this._setStatus(`${this.theme.charAt(0).toUpperCase() + this.theme.slice(1)} theme`, 'positive', 1600);
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
    if (this.themeValue) {
      this.themeValue.textContent = this.theme === 'light' ? 'Light' : 'Dark';
    }
  }

  _updateLayoutInfo() {
    if (!this.layoutValue) return;
    const count = countPanes(this.dock.layout);
    this.layoutValue.textContent = `${count} pane${count === 1 ? '' : 's'}`;
  }

  _setStatus(message, tone = 'normal', duration = 0) {
    if (!this.statusItem || !this.statusValue) return;
    if (this.statusTimer) {
      clearTimeout(this.statusTimer);
      this.statusTimer = null;
    }
    this.statusValue.textContent = message;
    if (tone && tone !== 'normal') {
      this.statusItem.dataset.tone = tone;
    } else {
      delete this.statusItem.dataset.tone;
    }
    if (duration > 0) {
      this.statusTimer = window.setTimeout(() => {
        this.statusTimer = null;
        this._setStatus('Ready');
      }, duration);
    }
  }
}
