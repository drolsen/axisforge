
import Explorer from '../panes/explorer.js';
import Properties from '../panes/properties.js';
import ConsolePane from '../panes/console.js';
import AssetsPane from '../panes/assets.js';
import { initViewport } from '../services/viewport.js';
import { checkForUpdates } from '../services/update-checker.js';
import UndoService from '../services/undo.js';
import { Selection } from '../services/selection.js';
import TranslationGizmo from '../components/gizmos.js';
import { EditorShell, DEFAULT_LAYOUT } from './shell.js';

function createPanel(title, description) {
  const container = document.createElement('div');
  container.className = 'panel-content';
  const heading = document.createElement('h2');
  heading.textContent = title;
  container.appendChild(heading);
  if (description) {
    const subtitle = document.createElement('p');
    subtitle.textContent = description;
    container.appendChild(subtitle);
  }
  return container;
}

function createExplorerPanel(explorer) {
  const container = createPanel('Explorer', 'Manage the scene hierarchy and quick actions.');
  container.appendChild(explorer.getElement());
  return container;
}

function createPropertiesPanel(properties) {
  const container = createPanel('Properties', 'Inspect and edit selection attributes.');
  const element = properties.getElement();
  if (element) {
    container.appendChild(element);
  } else {
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = 'Properties are unavailable in this environment.';
    container.appendChild(hint);
  }
  return container;
}

function createConsolePanel(consolePane) {
  const container = createPanel('Console', 'Captured log output from the editor runtime.');
  const actions = document.createElement('div');
  actions.className = 'panel-actions';
  const clearButton = document.createElement('button');
  clearButton.textContent = 'Clear';
  clearButton.addEventListener('click', () => {
    consolePane.clear();
    render(consolePane.getEntries());
  });
  actions.appendChild(clearButton);
  container.appendChild(actions);

  const logList = document.createElement('div');
  logList.className = 'panel-log';
  container.appendChild(logList);

  const render = entries => {
    logList.textContent = '';
    if (!entries.length) {
      const empty = document.createElement('div');
      empty.className = 'panel-empty';
      empty.textContent = 'No log messages yet.';
      logList.appendChild(empty);
      return;
    }
    entries.forEach((entry, index) => {
      const line = document.createElement('div');
      line.className = 'panel-log__entry';
      if (index === entries.length - 1 && entry) {
        line.classList.add('is-latest');
      }
      line.textContent = entry ?? '';
      logList.appendChild(line);
    });
    logList.scrollTop = logList.scrollHeight;
  };

  render(consolePane.getEntries());
  consolePane.onLog((_, entries) => render(entries));

  return container;
}

function createAssetsPanel(assetsPane, shell) {
  const container = createPanel('Assets', 'Project content imported into the editor.');
  const actions = document.createElement('div');
  actions.className = 'panel-actions';
  const refreshButton = document.createElement('button');
  refreshButton.textContent = 'Refresh';
  actions.appendChild(refreshButton);
  const importButton = document.createElement('button');
  importButton.textContent = 'Import…';
  actions.appendChild(importButton);
  container.appendChild(actions);

  const list = document.createElement('div');
  list.className = 'panel-list';
  container.appendChild(list);

  const renderAssets = assets => {
    list.textContent = '';
    if (!assets || !assets.length) {
      const empty = document.createElement('div');
      empty.className = 'panel-empty';
      empty.textContent = 'No assets imported yet.';
      list.appendChild(empty);
      return;
    }
    for (const asset of assets) {
      const item = document.createElement('div');
      item.className = 'panel-list__item';
      const title = document.createElement('div');
      title.className = 'panel-list__title';
      title.textContent = asset?.name || asset?.id || asset?.guid || 'Asset';
      item.appendChild(title);

      const meta = document.createElement('div');
      meta.className = 'panel-list__meta';
      const type = asset?.type || asset?.category || '';
      if (type) {
        const tag = document.createElement('span');
        tag.className = 'panel-tag';
        tag.textContent = type;
        meta.appendChild(tag);
      }
      const sourcePath = asset?.source?.path || asset?.path || asset?.uri;
      if (sourcePath) {
        const path = document.createElement('span');
        path.textContent = sourcePath;
        meta.appendChild(path);
      }
      item.appendChild(meta);
      list.appendChild(item);
    }
  };

  const loadAssets = async () => {
    try {
      const entries = await assetsPane.list();
      renderAssets(entries);
    } catch (err) {
      console.error('[Assets] Failed to list assets', err);
      const fail = document.createElement('div');
      fail.className = 'panel-empty';
      fail.textContent = 'Unable to load assets.';
      list.textContent = '';
      list.appendChild(fail);
    }
  };

  const requestImport = async () => {
    const defaultPath = '/assets/sample/scene.gltf';
    const input = window.prompt('Import glTF URL', defaultPath);
    if (!input) return;
    try {
      await assetsPane.importGLTF(input);
      await loadAssets();
      shell._setStatus('glTF imported', 'positive', 2000);
    } catch (err) {
      console.error('[Assets] Import failed', err);
      shell._setStatus('Import failed', 'error', 4000);
    }
  };

  refreshButton.addEventListener('click', () => {
    loadAssets();
  });
  importButton.addEventListener('click', () => {
    requestImport();
  });

  loadAssets();

  return { element: container, refresh: loadAssets, requestImport };
}

export function bootstrap() {
  const shell = new EditorShell();

  const undo = new UndoService();
  const selection = new Selection();

  const explorer = new Explorer(undo, selection);
  const properties = new Properties(undo, selection);
  const consolePane = new ConsolePane();
  const assetsPane = new AssetsPane(undefined, { floatingUI: false });

  new TranslationGizmo(selection, undo);

  const viewportPane = document.createElement('div');
  viewportPane.className = 'viewport-pane';

  const explorerPanel = createExplorerPanel(explorer);
  const propertiesPanel = createPropertiesPanel(properties);
  const consolePanel = createConsolePanel(consolePane);
  const assetsPanel = createAssetsPanel(assetsPane, shell);

  shell.registerPane({ id: 'viewport', title: 'Viewport', icon: 'icon--panes', element: viewportPane });
  shell.registerPane({ id: 'explorer', title: 'Explorer', icon: 'icon--explorer', element: explorerPanel });
  shell.registerPane({ id: 'properties', title: 'Properties', icon: 'icon--properties', element: propertiesPanel });
  shell.registerPane({ id: 'console', title: 'Console', icon: 'icon--console', element: consolePanel });
  shell.registerPane({ id: 'assets', title: 'Assets', icon: 'icon--assets', element: assetsPanel.element });

  shell.initializeLayout(DEFAULT_LAYOUT);

  initViewport({ mount: viewportPane });

  shell.root.addEventListener('axisforge:scene-save', () => {
    shell._setStatus('Scene save coming soon', 'warning', 1800);
  });

  shell.root.addEventListener('axisforge:scene-load', () => {
    shell._setStatus('Scene load coming soon', 'warning', 1800);
  });

  shell.root.addEventListener('axisforge:import-gltf', () => {
    assetsPanel.requestImport();
  });

  checkForUpdates();
}

bootstrap();
