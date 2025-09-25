
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

function createExplorerPanel(explorer, selection, shell) {
  const container = createPanel('Explorer', 'Manage the scene hierarchy and quick actions.');
  const actions = document.createElement('div');
  actions.className = 'panel-actions';

  const addModel = document.createElement('button');
  addModel.textContent = 'Add Model';
  addModel.addEventListener('click', () => {
    explorer.addModel();
    shell._setStatus('Model added to scene', 'positive', 1600);
  });

  const deleteSelected = document.createElement('button');
  deleteSelected.textContent = 'Delete Selected';
  deleteSelected.addEventListener('click', () => {
    explorer.deleteSelected();
    shell._setStatus('Selection cleared', 'warning', 1600);
  });

  actions.append(addModel, deleteSelected);
  container.appendChild(actions);

  const selectionInfo = document.createElement('div');
  selectionInfo.className = 'hint';
  container.appendChild(selectionInfo);

  const updateSelectionInfo = () => {
    const count = selection.get().length;
    deleteSelected.disabled = count === 0;
    selectionInfo.textContent = count
      ? `${count} item${count === 1 ? '' : 's'} selected`
      : 'No selection';
  };
  updateSelectionInfo();
  selection.Changed.Connect(updateSelectionInfo);

  const placeholder = document.createElement('div');
  placeholder.className = 'panel-empty';
  placeholder.textContent = 'Scene tree visualization is coming in Card 29.';
  container.appendChild(placeholder);

  return container;
}

function createPropertiesPanel(properties, selection) {
  const container = createPanel('Properties', 'Inspect and edit selection attributes.');
  const section = document.createElement('div');
  section.className = 'panel-section';
  container.appendChild(section);

  const nameField = document.createElement('div');
  nameField.className = 'panel-field';
  const nameLabel = document.createElement('span');
  nameLabel.className = 'panel-field__label';
  nameLabel.textContent = 'Name';
  const nameInputWrap = document.createElement('div');
  nameInputWrap.className = 'panel-field__input';
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = 'No selection';
  nameInput.disabled = true;
  nameInputWrap.appendChild(nameInput);
  nameField.append(nameLabel, nameInputWrap);
  section.appendChild(nameField);

  const vectorFields = {};
  for (const prop of ['Position', 'Rotation', 'Scale']) {
    const field = document.createElement('div');
    field.className = 'panel-field';
    const label = document.createElement('span');
    label.className = 'panel-field__label';
    label.textContent = prop;
    const inputsWrap = document.createElement('div');
    inputsWrap.className = 'panel-field__input';
    const inputs = {};
    for (const axis of ['x', 'y', 'z']) {
      const input = document.createElement('input');
      input.type = 'number';
      input.step = '0.01';
      input.disabled = true;
      input.placeholder = axis.toUpperCase();
      input.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          input.blur();
        }
      });
      input.addEventListener('change', () => {
        properties.editVectorComponent(prop, axis, input.value);
      });
      inputs[axis] = input;
      inputsWrap.appendChild(input);
    }
    field.append(label, inputsWrap);
    section.appendChild(field);
    vectorFields[prop] = inputs;
  }

  nameInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      nameInput.blur();
    }
  });
  nameInput.addEventListener('change', () => {
    properties.editName(nameInput.value);
  });

  const status = document.createElement('div');
  status.className = 'hint';
  status.textContent = 'Select an object to edit its properties.';
  container.appendChild(status);

  properties.onChange(state => {
    if (!state) {
      nameInput.disabled = true;
      nameInput.value = '';
      nameInput.placeholder = 'No selection';
      for (const inputs of Object.values(vectorFields)) {
        for (const input of Object.values(inputs)) {
          input.disabled = true;
          input.value = '';
          input.placeholder = input.placeholder ?? '';
        }
      }
      status.textContent = 'Select an object to edit its properties.';
      return;
    }

    nameInput.disabled = false;
    if (state.Name.mixed) {
      nameInput.value = '';
      nameInput.placeholder = 'Multiple values';
      nameInput.classList.add('is-mixed');
    } else {
      nameInput.value = state.Name.value ?? '';
      nameInput.placeholder = '';
      nameInput.classList.remove('is-mixed');
    }

    for (const prop of ['Position', 'Rotation', 'Scale']) {
      const vector = state[prop];
      const inputs = vectorFields[prop];
      for (const axis of ['x', 'y', 'z']) {
        const input = inputs[axis];
        input.disabled = false;
        const value = vector?.value?.[axis];
        input.value = typeof value === 'number' ? value.toFixed(3) : '';
        input.classList.toggle('is-mixed', Boolean(vector?.mixed?.[axis]));
        if (vector?.mixed?.[axis]) {
          input.placeholder = '—';
        } else {
          input.placeholder = axis.toUpperCase();
        }
      }
    }

    const count = selection.get().length;
    status.textContent = count
      ? `${count} object${count === 1 ? '' : 's'} selected`
      : 'Select an object to edit its properties.';
  });

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

  const explorerPanel = createExplorerPanel(explorer, selection, shell);
  const propertiesPanel = createPropertiesPanel(properties, selection);
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
