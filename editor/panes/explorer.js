import { Instance, Services, GetService } from '../../engine/core/index.js';
import { TransformNode } from '../../engine/render/mesh/meshInstance.js';
import { getWorkspace } from '../../engine/scene/workspace.js';
import UndoService from '../services/undo.js';
import { Selection } from '../services/selection.js';
import VirtualTree from '../ui/tree/tree.js';
import showContextMenu, { closeContextMenu } from '../ui/contextmenu.js';

const SERVICE_ORDER = [
  'Workspace',
  'Players',
  'Lighting',
  'ReplicatedStorage',
  'ServerStorage',
  'StarterGui',
  'StarterPack',
  'StarterPlayer',
  'SoundService',
  'MaterialService',
  'RunService',
  'UserInputService',
  'TweenService',
  'PhysicsService',
  'CollectionService',
];

function isDescendant(target, candidate) {
  if (!target || !candidate) return false;
  let current = target.Parent;
  while (current) {
    if (current === candidate) return true;
    current = current.Parent;
  }
  return false;
}

function defaultNameForClass(className) {
  if (className === 'Folder') return 'Folder';
  if (className === 'Model') return 'Model';
  if (className === 'Part') return 'Part';
  return className || 'Instance';
}

function createPlaceholderInstance(className) {
  if (className === 'Part') {
    const part = new TransformNode('Part');
    part.Name = defaultNameForClass('Part');
    return part;
  }
  const inst = new Instance(className);
  inst.Name = defaultNameForClass(className);
  return inst;
}

export default class Explorer {
  constructor(undo = new UndoService(), selection = new Selection()) {
    this.undo = undo;
    this.selection = selection;
    this._suspendSelection = false;
    this._connections = new Map();
    this._serviceSet = new Set();

    this.hasDOM = typeof document !== 'undefined' && typeof document.createElement === 'function';
    this._registered = new Set();

    if (this.hasDOM) {
      this.element = document.createElement('div');
      this.element.className = 'explorer-pane';

      this.search = document.createElement('div');
      this.search.className = 'explorer-pane__search';
      this.searchInput = document.createElement('input');
      this.searchInput.type = 'search';
      this.searchInput.placeholder = 'Search instances…';
      this.search.appendChild(this.searchInput);
      this.element.appendChild(this.search);

      this.treeHost = document.createElement('div');
      this.treeHost.className = 'explorer-pane__tree';
      this.element.appendChild(this.treeHost);

      this.status = document.createElement('div');
      this.status.className = 'explorer-pane__status';
      this.element.appendChild(this.status);

      this.tree = new VirtualTree(this.treeHost, {
        rowHeight: 24,
        indent: 16,
        getLabel: node => node?.Name ?? node?.ClassName ?? '',
        getIcon: node => this._getIconForNode(node),
      });

      this.tree.on('selectionchange', ({ selection }) => this._syncSelectionFromTree(selection));
      this.tree.on('rename', ({ node, name }) => this._renameNode(node, name));
      this.tree.on('drop', ({ nodes, target }) => this._handleDrop(nodes, target));
      this.tree.on('delete', ({ selection }) => {
        if (selection?.length) this.deleteSelection();
      });

      this.tree.viewport.addEventListener('contextmenu', event => {
        const entry = this.tree.getEntryFromElement(event.target);
        if (entry && !this.selection.isSelected(entry.node)) {
          this.tree.setSelection([entry.node]);
          this._syncSelectionFromTree([entry.node]);
        }
        const node = entry?.node ?? null;
        showContextMenu(event, this._buildContextMenu(node));
      });

      let searchTimer = null;
      this.searchInput.addEventListener('input', () => {
        window.clearTimeout(searchTimer);
        searchTimer = window.setTimeout(() => {
          this.tree.setFilter(this.searchInput.value);
        }, 160);
      });
      this.searchInput.addEventListener('keydown', event => {
        if (event.key === 'Escape' && this.searchInput.value) {
          this.searchInput.value = '';
          this.tree.setFilter('');
          event.stopPropagation();
        }
      });
    } else {
      this.element = null;
      this.status = null;
      this.tree = {
        setSelection: () => {},
        refresh: () => {},
        expand: () => {},
        collapse: () => {},
        expandPathTo: () => {},
        beginRename: () => {},
        setFilter: () => {},
        dispose: () => {},
        getChildren: node => (node?.Children ?? []),
      };
    }

    this.services = this._buildServices();
    if (this.hasDOM) {
      this.tree.setData(this.services);
      for (const service of this.services) {
        this._watchHierarchy(service);
      }
    }

    this.selectionConnection = this.selection.Changed.Connect(sel => {
      this._syncSelectionFromService(sel);
    });
    this._syncSelectionFromService(this.selection.get());
  }

  dispose() {
    closeContextMenu();
    if (this.selectionConnection) this.selectionConnection.Disconnect();
    for (const [node, connections] of this._connections.entries()) {
      for (const conn of connections) {
        conn?.Disconnect?.();
      }
    }
    this._connections.clear();
    this.tree.dispose();
  }

  getElement() {
    return this.element;
  }

  _buildServices() {
    const result = [];
    this._serviceSet.clear();
    for (const name of SERVICE_ORDER) {
      const service = this._ensureService(name);
      if (service && !result.includes(service)) {
        result.push(service);
        this._serviceSet.add(service);
      }
    }
    return result;
  }

  _ensureService(name) {
    if (name === 'Workspace') {
      const workspace = getWorkspace();
      workspace.Name = 'Workspace';
      return workspace;
    }
    let service = GetService(name);
    if (!service) {
      service = new Instance(name);
      service.Name = name;
      if (Services && typeof Services.set === 'function') {
        Services.set(name, service);
      }
    }
    return service;
  }

  _watchHierarchy(node) {
    if (!node || this._connections.has(node)) return;
    const connections = [];
    if (node.ChildAdded?.Connect) {
      connections.push(node.ChildAdded.Connect(child => {
        this._watchHierarchy(child);
        this.tree.refresh();
      }));
    }
    if (node.ChildRemoved?.Connect) {
      connections.push(node.ChildRemoved.Connect(child => {
        this._unwatch(child);
        this.tree.refresh();
      }));
    }
    if (node.AncestryChanged?.Connect) {
      connections.push(node.AncestryChanged.Connect(() => {
        this.tree.refresh();
      }));
    }
    if (node.Changed?.Connect) {
      connections.push(node.Changed.Connect(prop => {
        if (prop === 'Name') {
          this.tree.refresh();
        }
      }));
    }
    this._connections.set(node, connections);
    const children = this.tree.getChildren(node) ?? [];
    for (const child of children) {
      this._watchHierarchy(child);
    }
  }

  _unwatch(node) {
    if (!node) return;
    const connections = this._connections.get(node);
    if (connections) {
      for (const conn of connections) {
        conn?.Disconnect?.();
      }
      this._connections.delete(node);
    }
    const children = this.tree.getChildren(node) ?? [];
    for (const child of children) {
      this._unwatch(child);
    }
  }

  _syncSelectionFromTree(nodes) {
    if (this._suspendSelection) return;
    this._suspendSelection = true;
    this.selection.set(nodes);
    this._updateStatus();
    this._suspendSelection = false;
  }

  _syncSelectionFromService(nodes) {
    if (this._suspendSelection) return;
    this._suspendSelection = true;
    const list = Array.isArray(nodes) ? nodes : [];
    if (list[0]) {
      this.tree.expandPathTo(list[0]);
    }
    this.tree.setSelection(list);
    this._updateStatus();
    this._suspendSelection = false;
  }

  _updateStatus() {
    if (!this.status) return;
    const count = this.selection.get().length;
    if (!count) {
      this.status.textContent = 'No selection';
      return;
    }
    this.status.innerHTML = `<strong>${count}</strong> item${count === 1 ? '' : 's'} selected`;
  }

  _renameNode(node, name) {
    if (!node) return;
    const command = this.undo.setProperty(node, 'Name', name);
    this.undo.execute(command);
    this.tree.refresh();
  }

  _handleDrop(nodes, target) {
    if (!target || !Array.isArray(nodes) || nodes.length === 0) return;
    const filtered = nodes.filter(node => node && node !== target && !isDescendant(target, node));
    if (!filtered.length) return;
    const commands = filtered.map(node => this.undo.reparent(node, target));
    if (!commands.length) return;
    if (commands.length === 1) {
      this.undo.execute(commands[0]);
    } else {
      this.undo.execute({
        undo: () => {
          for (const cmd of [...commands].reverse()) cmd.undo();
        },
        redo: () => {
          for (const cmd of commands) cmd.redo();
        },
      });
    }
    this.tree.expand(target);
    this.selection.set(filtered);
    this.tree.setSelection(filtered);
    this.tree.refresh();
  }

  deleteSelection() {
    const items = this.selection.get().filter(node => node && node.Parent);
    if (!items.length) return;
    const commands = items.map(node => this.undo.deleteInstance(node));
    if (commands.length === 1) {
      this.undo.execute(commands[0]);
    } else {
      this.undo.execute({
        undo: () => {
          for (const cmd of [...commands].reverse()) cmd.undo();
        },
        redo: () => {
          for (const cmd of commands) cmd.redo();
        },
      });
    }
    this.selection.clear();
    this.tree.setSelection([]);
    this.tree.refresh();
  }

  register(inst) {
    if (!inst) return;
    this._registered.add(inst);
    if (this.hasDOM) {
      this._watchHierarchy(inst);
      this.tree.refresh();
    }
  }

  unregister(inst) {
    if (!inst) return;
    this._registered.delete(inst);
    if (this.hasDOM) {
      this._unwatch(inst);
      this.tree.refresh();
    }
    if (this.selection.isSelected(inst)) {
      this.selection.remove(inst);
    }
  }

  getAllNodes() {
    const result = [];
    const seen = new Set();
    const visit = node => {
      if (!node || seen.has(node)) return;
      seen.add(node);
      result.push(node);
      const children = this.tree.getChildren(node) || [];
      for (const child of children) {
        visit(child);
      }
    };
    if (Array.isArray(this.services)) {
      for (const service of this.services) {
        visit(service);
      }
    }
    return result;
  }

  click(inst, { additive = false, toggle = false } = {}) {
    if (!inst) {
      this.selection.clear();
      if (this.hasDOM) this.tree.setSelection([]);
      return this.selection.get();
    }

    if (toggle && this.selection.isSelected(inst)) {
      this.selection.remove(inst);
      if (this.hasDOM) this.tree.setSelection(this.selection.get());
      return this.selection.get();
    }

    if (additive) {
      this.selection.add(inst);
    } else {
      this.selection.set([inst]);
    }

    if (this.hasDOM) this.tree.setSelection(this.selection.get());
    return this.selection.get();
  }

  focusNode(node, { openContextMenu = false } = {}) {
    if (!node) return false;
    this.selection.set([node]);
    if (this.hasDOM) {
      this.tree.expandPathTo(node);
      this.tree.setSelection([node]);
      this.tree.scrollTo(node);
      if (openContextMenu) {
        window.requestAnimationFrame(() => {
          const id = this.tree.getId(node);
          const row = this.tree.viewport?.querySelector?.(`.virtual-tree__row[data-node-id="${id}"]`);
          if (!row) return;
          const rect = row.getBoundingClientRect();
          const position = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          };
          const items = this._buildContextMenu(node);
          if (items?.length) {
            showContextMenu(position, items);
          }
        });
      }
    }
    return true;
  }

  isSelected(inst) {
    return this.selection.isSelected(inst);
  }

  addModel() {
    const target = this.selection.get()[0] ?? getWorkspace();
    const model = createPlaceholderInstance('Model');
    this.undo.execute(this.undo.createInstance(model, target));
    if (this.hasDOM) {
      this.tree.expand(target);
      this.tree.setSelection([model]);
    }
    this.selection.set([model]);
    this.tree.refresh();
    return model;
  }

  deleteSelected() {
    this.deleteSelection();
  }

  duplicateSelection() {
    const items = this.selection.get().filter(Boolean);
    if (!items.length) return;
    const created = [];
    const commands = [];
    for (const item of items) {
      const parent = item.Parent ?? getWorkspace();
      const clone = this._cloneInstance(item);
      created.push(clone);
      commands.push(this.undo.createInstance(clone, parent));
    }
    if (!commands.length) return;
    if (commands.length === 1) {
      this.undo.execute(commands[0]);
    } else {
      this.undo.execute({
        undo: () => {
          for (const cmd of [...commands].reverse()) cmd.undo();
        },
        redo: () => {
          for (const cmd of commands) cmd.redo();
        },
      });
    }
    this.selection.set(created);
    this.tree.setSelection(created);
    if (created[0]?.Parent) {
      this.tree.expand(created[0].Parent);
    }
    this.tree.refresh();
  }

  groupSelection() {
    const items = this.selection.get().filter(Boolean);
    if (items.length < 2) return;
    const parent = this._findCommonParent(items) ?? getWorkspace();
    const group = createPlaceholderInstance('Model');
    group.Name = 'Group';
    const originalParents = new Map();
    for (const item of items) {
      originalParents.set(item, item.Parent ?? null);
    }
    this.undo.execute({
      undo: () => {
        for (const item of [...items].reverse()) {
          item.Parent = originalParents.get(item) ?? null;
        }
        group.Parent = null;
      },
      redo: () => {
        group.Parent = parent;
        for (const item of items) {
          item.Parent = group;
        }
      },
    });
    this.selection.set([group]);
    this.tree.setSelection([group]);
    this.tree.expand(group);
    this.tree.refresh();
    this.tree.beginRename(group);
  }

  ungroupSelection() {
    const items = this.selection.get().filter(node => node && this._isGroup(node));
    if (!items.length) return;
    const commands = items.map(group => {
      const parent = group.Parent ?? null;
      const children = [...(group.Children ?? [])];
      return {
        undo: () => {
          group.Parent = parent;
          for (const child of children) {
            child.Parent = group;
          }
        },
        redo: () => {
          for (const child of children) {
            child.Parent = parent;
          }
          group.Parent = null;
        },
      };
    });
    this.undo.execute({
      undo: () => {
        for (const cmd of [...commands].reverse()) cmd.undo();
      },
      redo: () => {
        for (const cmd of commands) cmd.redo();
      },
    });
    this.selection.clear();
    this.tree.setSelection([]);
    this.tree.refresh();
  }

  collapseSelection(recursive = false) {
    const items = this.selection.get().filter(Boolean);
    if (!items.length) return;
    for (const item of items) {
      this.tree.collapse(item, recursive);
    }
  }

  expandSelection(recursive = false) {
    const items = this.selection.get().filter(Boolean);
    if (!items.length) return;
    for (const item of items) {
      this.tree.expand(item, recursive);
    }
  }

  _findCommonParent(nodes) {
    if (!nodes.length) return null;
    let parent = nodes[0].Parent ?? null;
    for (const node of nodes) {
      if (node.Parent !== parent) return null;
    }
    return parent;
  }

  _isGroup(node) {
    if (!node) return false;
    return node.ClassName === 'Model' || node.ClassName === 'Folder';
  }

  _cloneInstance(instance) {
    if (!instance) return null;
    let clone;
    if (instance.ClassName === 'Part') {
      clone = createPlaceholderInstance('Part');
    } else {
      try {
        clone = new instance.constructor(instance.ClassName);
      } catch (err) {
        clone = createPlaceholderInstance(instance.ClassName);
      }
    }
    clone.Name = `${instance.Name ?? instance.ClassName} Copy`;
    if (instance.Attributes instanceof Map) {
      for (const [key, value] of instance.Attributes.entries()) {
        clone.SetAttribute?.(key, value);
      }
    }
    const children = instance.Children ?? [];
    for (const child of children) {
      const childClone = this._cloneInstance(child);
      if (childClone) childClone.Parent = clone;
    }
    return clone;
  }

  _buildContextMenu(node) {
    const selection = this.selection.get();
    const hasSelection = selection.length > 0;
    const deletable = selection.some(item => item && item.Parent);
    const canGroup = selection.length > 1;
    const canUngroup = selection.some(item => this._isGroup(item));
    return [
      {
        label: 'New',
        children: [
          { label: 'Model', action: () => this._createChild('Model', node) },
          { label: 'Folder', action: () => this._createChild('Folder', node) },
          { label: 'Part', action: () => this._createChild('Part', node) },
        ],
      },
      { type: 'separator' },
      { label: 'Duplicate', action: () => this.duplicateSelection(), disabled: !hasSelection },
      { label: 'Delete', action: () => this.deleteSelection(), shortcut: 'Del', disabled: !deletable },
      { type: 'separator' },
      { label: 'Group', action: () => this.groupSelection(), disabled: !canGroup },
      { label: 'Ungroup', action: () => this.ungroupSelection(), disabled: !canUngroup },
      { type: 'separator' },
      { label: 'Collapse', action: () => this.collapseSelection(false), disabled: !hasSelection },
      { label: 'Collapse All', action: () => this.collapseSelection(true), disabled: !hasSelection },
      { label: 'Expand', action: () => this.expandSelection(false), disabled: !hasSelection },
      { label: 'Expand All', action: () => this.expandSelection(true), disabled: !hasSelection },
    ];
  }

  _createChild(className, anchor) {
    const selection = this.selection.get();
    let parent = anchor ?? selection[0] ?? getWorkspace();
    if (!parent || isDescendant(parent, anchor)) {
      parent = getWorkspace();
    }
    const instance = createPlaceholderInstance(className);
    this.undo.execute(this.undo.createInstance(instance, parent));
    this.tree.expand(parent);
    this.selection.set([instance]);
    this.tree.setSelection([instance]);
    this.tree.refresh();
    this.tree.beginRename(instance);
  }

  _getIconForNode(node) {
    if (!node) return null;
    if (this._serviceSet.has(node)) {
      if (node.ClassName === 'Lighting') return 'icon--light';
      return 'icon--service';
    }
    const className = node.ClassName ?? '';
    if (className === 'Folder' || className === 'Model') return 'icon--folder';
    if (/script/i.test(className)) return 'icon--script';
    if (/camera/i.test(className)) return 'icon--camera';
    if (/light/i.test(className)) return 'icon--light';
    if (/material/i.test(className)) return 'icon--material';
    if (/part/i.test(className) || /mesh/i.test(className)) return 'icon--cube';
    return 'icon--cube';
  }
}
