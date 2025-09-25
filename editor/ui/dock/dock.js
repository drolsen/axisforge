
const STORAGE_KEY = 'axisforge.layout.v1';
let stackIdCounter = 0;

function generateStackId() {
  stackIdCounter += 1;
  return `stack-${Date.now().toString(36)}-${stackIdCounter}`;
}

function normalizeArray(values = []) {
  if (!Array.isArray(values) || !values.length) return [];
  const sum = values.reduce((acc, value) => acc + (Number.isFinite(value) && value > 0 ? value : 0), 0);
  if (sum <= 0) {
    const fill = 1 / values.length;
    return values.map(() => fill);
  }
  return values.map(value => {
    const safe = Number.isFinite(value) && value > 0 ? value : sum / values.length;
    return safe / sum;
  });
}

function normalizeLayout(node) {
  if (!node) return null;
  if (node.type === 'stack') {
    const tabs = Array.isArray(node.tabs) ? node.tabs.slice() : [];
    if (!tabs.length) return null;
    const active = tabs.includes(node.active) ? node.active : tabs[0];
    return { ...node, tabs, active };
  }
  if (node.type === 'split') {
    const children = node.children
      .map(child => normalizeLayout(child))
      .filter(Boolean);
    if (!children.length) return null;
    if (children.length === 1) {
      return children[0];
    }
    const sizes = normalizeArray(node.sizes && node.sizes.length === children.length ? node.sizes : new Array(children.length).fill(1));
    return {
      type: 'split',
      direction: node.direction === 'vertical' ? 'vertical' : 'horizontal',
      children,
      sizes,
    };
  }
  return null;
}

function cloneLayout(node) {
  if (!node) return null;
  if (node.type === 'stack') {
    return {
      type: 'stack',
      id: node.id,
      tabs: node.tabs.slice(),
      active: node.active,
    };
  }
  if (node.type === 'split') {
    return {
      type: 'split',
      direction: node.direction,
      sizes: node.sizes.slice(),
      children: node.children.map(child => cloneLayout(child)),
    };
  }
  return null;
}

function pruneLayout(node, panes) {
  if (!node) return null;
  if (node.type === 'stack') {
    const tabs = (node.tabs || []).filter(id => panes.has(id));
    if (!tabs.length) return null;
    const active = tabs.includes(node.active) ? node.active : tabs[0];
    return { ...node, tabs, active };
  }
  if (node.type === 'split') {
    const children = [];
    for (const child of node.children || []) {
      const pruned = pruneLayout(child, panes);
      if (pruned) {
        children.push(pruned);
      }
    }
    if (!children.length) return null;
    if (children.length === 1) return children[0];
    return {
      type: 'split',
      direction: node.direction,
      children,
      sizes: normalizeArray(node.sizes && node.sizes.length === children.length ? node.sizes : new Array(children.length).fill(1)),
    };
  }
  return null;
}

function layoutContainsPane(node, paneId) {
  if (!node) return false;
  if (node.type === 'stack') {
    return node.tabs.includes(paneId);
  }
  return node.children.some(child => layoutContainsPane(child, paneId));
}

function createStack(paneId) {
  return {
    type: 'stack',
    id: generateStackId(),
    tabs: paneId ? [paneId] : [],
    active: paneId ?? null,
  };
}

function findFirstStackId(node) {
  if (!node) return null;
  if (node.type === 'stack') return node.id;
  for (const child of node.children) {
    const id = findFirstStackId(child);
    if (id) return id;
  }
  return null;
}

function getNodeAtPath(node, path = []) {
  let current = node;
  for (const index of path) {
    if (!current || current.type !== 'split') return null;
    current = current.children[index];
  }
  return current || null;
}

function detachPane(node, paneId, path = []) {
  if (!node) {
    return { node: null, removedFrom: null, changed: false };
  }
  if (node.type === 'stack') {
    const index = node.tabs.indexOf(paneId);
    if (index === -1) {
      return { node, removedFrom: null, changed: false };
    }
    const tabs = node.tabs.filter(id => id !== paneId);
    if (!tabs.length) {
      return { node: null, removedFrom: { stackId: node.id, path }, changed: true };
    }
    const active = tabs.includes(node.active) ? node.active : tabs[0];
    return { node: { ...node, tabs, active }, removedFrom: { stackId: node.id, path }, changed: true };
  }
  if (node.type === 'split') {
    let changed = false;
    let removedFrom = null;
    const children = [];
    const sizes = [];
    for (let i = 0; i < node.children.length; i += 1) {
      const res = detachPane(node.children[i], paneId, path.concat(i));
      if (res.changed) {
        changed = true;
      }
      if (res.removedFrom && !removedFrom) {
        removedFrom = res.removedFrom;
      }
      if (res.node) {
        children.push(res.node);
        sizes.push(node.sizes && node.sizes[i] != null ? node.sizes[i] : 1);
      }
    }
    if (!changed) {
      return { node, removedFrom: null, changed: false };
    }
    if (!children.length) {
      return { node: null, removedFrom, changed: true };
    }
    if (children.length === 1) {
      return { node: children[0], removedFrom, changed: true };
    }
    return {
      node: {
        type: 'split',
        direction: node.direction,
        children,
        sizes: normalizeArray(sizes),
      },
      removedFrom,
      changed: true,
    };
  }
  return { node, removedFrom: null, changed: false };
}

function attachPaneToStack(node, stackId, paneId) {
  if (!node) return null;
  if (node.type === 'stack') {
    if (node.id !== stackId) return node;
    const tabs = node.tabs.includes(paneId) ? node.tabs : [...node.tabs, paneId];
    return { ...node, tabs, active: paneId };
  }
  if (node.type === 'split') {
    return {
      type: 'split',
      direction: node.direction,
      sizes: node.sizes.slice(),
      children: node.children.map(child => attachPaneToStack(child, stackId, paneId)),
    };
  }
  return node;
}

function replaceStackWithSplit(node, stackId, paneId, position) {
  if (!node) return null;
  if (node.type === 'stack') {
    if (node.id !== stackId) return node;
    const direction = position === 'left' || position === 'right' ? 'horizontal' : 'vertical';
    const newStack = createStack(paneId);
    const existing = { ...node };
    const children = position === 'left' || position === 'top' ? [newStack, existing] : [existing, newStack];
    const sizes = position === 'left' || position === 'top' ? [0.38, 0.62] : [0.62, 0.38];
    return {
      type: 'split',
      direction,
      children,
      sizes,
    };
  }
  if (node.type === 'split') {
    return {
      type: 'split',
      direction: node.direction,
      sizes: node.sizes.slice(),
      children: node.children.map(child => replaceStackWithSplit(child, stackId, paneId, position)),
    };
  }
  return node;
}

function splitRoot(node, paneId, position) {
  const newStack = createStack(paneId);
  if (!node) {
    return newStack;
  }
  const direction = position === 'left' || position === 'right' ? 'horizontal' : 'vertical';
  const children = position === 'left' || position === 'top' ? [newStack, node] : [node, newStack];
  const sizes = position === 'left' || position === 'top' ? [0.35, 0.65] : [0.65, 0.35];
  return {
    type: 'split',
    direction,
    children,
    sizes,
  };
}

function findStack(node, stackId) {
  if (!node) return null;
  if (node.type === 'stack') {
    return node.id === stackId ? node : null;
  }
  for (const child of node.children) {
    const found = findStack(child, stackId);
    if (found) return found;
  }
  return null;
}

function setActiveInStack(node, stackId, paneId) {
  if (!node) return null;
  if (node.type === 'stack') {
    if (node.id !== stackId || !node.tabs.includes(paneId)) return node;
    return { ...node, active: paneId };
  }
  if (node.type === 'split') {
    return {
      type: 'split',
      direction: node.direction,
      sizes: node.sizes.slice(),
      children: node.children.map(child => setActiveInStack(child, stackId, paneId)),
    };
  }
  return node;
}

function ensurePanePresence(layout, paneId) {
  if (layoutContainsPane(layout, paneId)) return layout;
  if (!layout) {
    return normalizeLayout(createStack(paneId));
  }
  const firstStackId = findFirstStackId(layout);
  if (!firstStackId) {
    return normalizeLayout(createStack(paneId));
  }
  return normalizeLayout(attachPaneToStack(layout, firstStackId, paneId));
}

function movePane(layout, paneId, drop) {
  const base = layout ?? null;
  const { node: without } = detachPane(base, paneId);
  let working = without;
  if (!working) {
    if (!drop || drop.type === 'stack') {
      return normalizeLayout(createStack(paneId));
    }
    working = null;
  }
  if (!drop) {
    const fallback = findFirstStackId(working);
    if (!fallback) {
      return normalizeLayout(createStack(paneId));
    }
    return normalizeLayout(attachPaneToStack(working, fallback, paneId));
  }
  if (drop.type === 'stack') {
    const target = findStack(working, drop.stackId);
    if (!target) {
      const fallback = findFirstStackId(working);
      if (!fallback) {
        return normalizeLayout(createStack(paneId));
      }
      return normalizeLayout(attachPaneToStack(working, fallback, paneId));
    }
    return normalizeLayout(attachPaneToStack(working, drop.stackId, paneId));
  }
  if (drop.type === 'split') {
    const target = findStack(working, drop.stackId);
    if (!target) {
      return normalizeLayout(splitRoot(working, paneId, drop.position));
    }
    return normalizeLayout(replaceStackWithSplit(working, drop.stackId, paneId, drop.position));
  }
  if (drop.type === 'root') {
    return normalizeLayout(splitRoot(working, paneId, drop.position));
  }
  return normalizeLayout(working);
}

function clearElement(el) {
  if (!el) return;
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

export class DockArea {
  constructor(container, { storageKey = STORAGE_KEY } = {}) {
    this.container = container;
    this.container.classList.add('dock-root');
    this.storageKey = storageKey;
    this.panes = new Map();
    this.layout = null;
    this.defaultLayout = null;
    this.stackRefs = new Map();
    this.dragState = null;
    this.currentDrop = null;
  }

  registerPane(pane) {
    if (!pane || !pane.id) return;
    this.panes.set(pane.id, pane);
  }

  initialize(defaultLayout) {
    const normalizedDefault = normalizeLayout(pruneLayout(defaultLayout, this.panes)) ?? null;
    this.defaultLayout = normalizedDefault ? cloneLayout(normalizedDefault) : null;
    const stored = this._loadStoredLayout();
    let layout = stored ?? normalizedDefault;
    if (!layout) {
      const firstPane = Array.from(this.panes.keys())[0];
      layout = firstPane ? normalizeLayout(createStack(firstPane)) : null;
    }
    for (const paneId of this.panes.keys()) {
      layout = ensurePanePresence(layout, paneId);
    }
    this.layout = layout;
    this.render();
  }

  _loadStoredLayout() {
    if (typeof localStorage === 'undefined') return null;
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return normalizeLayout(pruneLayout(parsed, this.panes));
    } catch (err) {
      console.warn('[DockArea] Failed to parse saved layout', err);
      return null;
    }
  }

  persistLayout() {
    if (typeof localStorage === 'undefined' || !this.layout) return;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.layout));
    } catch (err) {
      console.warn('[DockArea] Failed to persist layout', err);
    }
  }

  updateLayout(updater, { save = true } = {}) {
    const next = normalizeLayout(updater(this.layout));
    if (!next) return;
    this.layout = next;
    this.render();
    if (save) {
      this.persistLayout();
    }
  }

  setActive(stackId, paneId) {
    this.updateLayout(layout => setActiveInStack(layout, stackId, paneId));
  }

  render() {
    this.stackRefs.clear();
    this.container.dataset.drop = '';
    for (const pane of this.panes.values()) {
      if (pane.element && pane.element.parentNode) {
        pane.element.parentNode.removeChild(pane.element);
      }
    }
    clearElement(this.container);
    if (!this.layout) {
      const empty = document.createElement('div');
      empty.className = 'dock-empty';
      empty.textContent = 'No panels';
      this.container.appendChild(empty);
      return;
    }
    const rootNode = this._buildNode(this.layout, []);
    if (rootNode) {
      this.container.appendChild(rootNode);
    }
  }

  resetToDefault() {
    if (!this.defaultLayout) return;
    this.layout = cloneLayout(this.defaultLayout);
    this.render();
    this.persistLayout();
  }

  isPaneVisible(paneId) {
    return layoutContainsPane(this.layout, paneId);
  }

  showPane(paneId) {
    if (!paneId) return;
    this.updateLayout(layout => ensurePanePresence(layout, paneId));
  }

  hidePane(paneId) {
    if (!paneId) return;
    this.updateLayout(layout => {
      const result = detachPane(layout, paneId);
      return result.node ?? layout;
    });
  }

  setPaneVisibility(paneId, visible) {
    if (visible === this.isPaneVisible(paneId)) return;
    if (visible) {
      this.showPane(paneId);
    } else {
      this.hidePane(paneId);
    }
  }

  togglePane(paneId) {
    const nextVisible = !this.isPaneVisible(paneId);
    this.setPaneVisibility(paneId, nextVisible);
    return this.isPaneVisible(paneId);
  }

  _buildNode(node, path) {
    if (!node) return document.createElement('div');
    if (node.type === 'split') {
      return this._buildSplit(node, path);
    }
    if (node.type === 'stack') {
      return this._buildStack(node);
    }
    return document.createElement('div');
  }

  _buildSplit(node, path) {
    const container = document.createElement('div');
    container.className = 'dock-split ' + (node.direction === 'vertical' ? 'dock-split--vertical' : 'dock-split--horizontal');
    const childWrappers = [];
    for (let i = 0; i < node.children.length; i += 1) {
      if (i > 0) {
        const splitter = document.createElement('div');
        splitter.className = 'dock-splitter';
        container.appendChild(splitter);
        this._attachSplitter(splitter, path, i - 1, node.direction, childWrappers);
      }
      const childPath = path.concat(i);
      const wrapper = document.createElement('div');
      wrapper.className = 'dock-node';
      wrapper.style.flex = `${node.sizes[i]} 1 0%`;
      const child = this._buildNode(node.children[i], childPath);
      wrapper.appendChild(child);
      container.appendChild(wrapper);
      childWrappers.push(wrapper);
    }
    return container;
  }

  _attachSplitter(splitter, path, index, direction, childWrappers) {
    const onPointerDown = event => {
      if (event.button !== 0) return;
      event.preventDefault();
      const before = childWrappers[index];
      const after = childWrappers[index + 1];
      if (!before || !after) return;
      const splitNode = getNodeAtPath(this.layout, path);
      if (!splitNode || splitNode.type !== 'split') return;
      const isHorizontal = direction !== 'vertical';
      const beforeRect = before.getBoundingClientRect();
      const afterRect = after.getBoundingClientRect();
      const total = isHorizontal ? beforeRect.width + afterRect.width : beforeRect.height + afterRect.height;
      if (total <= 0) return;
      const start = isHorizontal ? event.clientX : event.clientY;
      const min = 120;
      const combined = splitNode.sizes[index] + splitNode.sizes[index + 1];
      const move = moveEvent => {
        const current = isHorizontal ? moveEvent.clientX : moveEvent.clientY;
        let delta = current - start;
        let beforeSize = (isHorizontal ? beforeRect.width : beforeRect.height) + delta;
        let afterSize = total - beforeSize;
        if (beforeSize < min) {
          beforeSize = min;
          afterSize = total - min;
        }
        if (afterSize < min) {
          afterSize = min;
          beforeSize = total - min;
        }
        const beforeRatio = Math.max(beforeSize / total, 0);
        const afterRatio = Math.max(afterSize / total, 0);
        const beforeWeight = beforeRatio * combined;
        const afterWeight = Math.max(combined - beforeWeight, 0.0001);
        splitNode.sizes[index] = beforeWeight;
        splitNode.sizes[index + 1] = afterWeight;
        before.style.flex = `${splitNode.sizes[index]} 1 0%`;
        after.style.flex = `${splitNode.sizes[index + 1]} 1 0%`;
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        splitter.classList.remove('is-active');
        this.persistLayout();
      };
      splitter.classList.add('is-active');
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up, { once: true });
      window.addEventListener('pointercancel', up, { once: true });
    };
    splitter.addEventListener('pointerdown', onPointerDown);
  }

  _buildStack(node) {
    const stack = document.createElement('div');
    stack.className = 'dock-stack';
    stack.dataset.stackId = node.id;
    const tabs = document.createElement('div');
    tabs.className = 'dock-tabs';
    const overlay = document.createElement('div');
    overlay.className = 'dock-drop-overlay';
    stack.appendChild(tabs);
    const content = document.createElement('div');
    content.className = 'dock-content';
    stack.appendChild(content);
    stack.appendChild(overlay);

    this.stackRefs.set(node.id, stack);

    for (const paneId of node.tabs) {
      const pane = this.panes.get(paneId);
      if (!pane) continue;
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'dock-tab' + (paneId === node.active ? ' is-active' : '');
      tab.dataset.paneId = paneId;
      tab.dataset.stackId = node.id;
      if (pane.icon) {
        const icon = document.createElement('span');
        icon.className = `icon ${pane.icon}`;
        tab.appendChild(icon);
      }
      const label = document.createElement('span');
      label.textContent = pane.title ?? paneId;
      tab.appendChild(label);
      tab.addEventListener('click', () => this.setActive(node.id, paneId));
      tab.addEventListener('pointerdown', event => this._onTabPointerDown(event, paneId, node.id, pane.title ?? paneId));
      tabs.appendChild(tab);
    }

    const activePaneId = node.active && node.tabs.includes(node.active) ? node.active : node.tabs[0];
    if (activePaneId) {
      const pane = this.panes.get(activePaneId);
      if (pane && pane.element) {
        content.appendChild(pane.element);
      }
    } else {
      const empty = document.createElement('div');
      empty.className = 'dock-empty';
      empty.textContent = 'No panel';
      content.appendChild(empty);
    }

    return stack;
  }

  _onTabPointerDown(event, paneId, stackId, title) {
    if (event.button !== 0) return;
    event.preventDefault();
    const pointerId = event.pointerId;
    const moveHandler = ev => this._onDragMove(ev);
    const upHandler = ev => this._onDragUp(ev);
    this.dragState = {
      pointerId,
      paneId,
      stackId,
      title,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
      ghost: null,
      moveHandler,
      upHandler,
    };
    window.addEventListener('pointermove', moveHandler);
    window.addEventListener('pointerup', upHandler);
    window.addEventListener('pointercancel', upHandler);
  }

  _startDragging() {
    if (!this.dragState || this.dragState.dragging) return;
    this.dragState.dragging = true;
    const ghost = document.createElement('div');
    ghost.className = 'dock-drag-ghost';
    ghost.textContent = this.dragState.title;
    document.body.appendChild(ghost);
    this.dragState.ghost = ghost;
  }

  _onDragMove(event) {
    if (!this.dragState || event.pointerId !== this.dragState.pointerId) return;
    const dx = event.clientX - this.dragState.startX;
    const dy = event.clientY - this.dragState.startY;
    if (!this.dragState.dragging) {
      if (Math.hypot(dx, dy) > 6) {
        this._startDragging();
      } else {
        return;
      }
    }
    if (this.dragState.ghost) {
      this.dragState.ghost.style.left = `${event.clientX}px`;
      this.dragState.ghost.style.top = `${event.clientY}px`;
    }
    this._updateDropTarget(event.clientX, event.clientY);
  }

  _clearDropHighlights() {
    for (const el of this.stackRefs.values()) {
      el.dataset.drop = '';
    }
    this.container.dataset.drop = '';
  }

  _updateDropTarget(clientX, clientY) {
    this._clearDropHighlights();
    let drop = null;
    for (const [stackId, element] of this.stackRefs.entries()) {
      const rect = element.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
        const edge = 0.22;
        const xRatio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0.5;
        const yRatio = rect.height > 0 ? (clientY - rect.top) / rect.height : 0.5;
        let position = 'center';
        if (xRatio < edge) position = 'left';
        else if (xRatio > 1 - edge) position = 'right';
        else if (yRatio < edge) position = 'top';
        else if (yRatio > 1 - edge) position = 'bottom';
        if (position === 'center') {
          drop = { type: 'stack', stackId, position };
        } else {
          drop = { type: 'split', stackId, position };
        }
        element.dataset.drop = position;
        break;
      }
    }
    if (!drop) {
      const rootRect = this.container.getBoundingClientRect();
      if (clientX >= rootRect.left && clientX <= rootRect.right && clientY >= rootRect.top && clientY <= rootRect.bottom) {
        const margin = 0.12;
        const xRatio = (clientX - rootRect.left) / Math.max(rootRect.width, 1);
        const yRatio = (clientY - rootRect.top) / Math.max(rootRect.height, 1);
        if (xRatio < margin) {
          drop = { type: 'root', position: 'left' };
        } else if (xRatio > 1 - margin) {
          drop = { type: 'root', position: 'right' };
        } else if (yRatio < margin) {
          drop = { type: 'root', position: 'top' };
        } else if (yRatio > 1 - margin) {
          drop = { type: 'root', position: 'bottom' };
        }
        if (drop) {
          this.container.dataset.drop = drop.position;
        }
      }
    }
    this.currentDrop = drop;
  }

  _teardownDragListeners() {
    if (!this.dragState) return;
    window.removeEventListener('pointermove', this.dragState.moveHandler);
    window.removeEventListener('pointerup', this.dragState.upHandler);
    window.removeEventListener('pointercancel', this.dragState.upHandler);
  }

  _endDrag() {
    if (!this.dragState) return;
    this._teardownDragListeners();
    if (this.dragState.ghost) {
      this.dragState.ghost.remove();
    }
    this.dragState = null;
    this._clearDropHighlights();
  }

  _onDragUp(event) {
    if (!this.dragState || event.pointerId !== this.dragState.pointerId) return;
    const state = this.dragState;
    const drop = this.currentDrop;
    const shouldApply = state.dragging && drop;
    this._endDrag();
    if (shouldApply && drop) {
      if (drop.type === 'stack' && drop.stackId === state.stackId && drop.position === 'center') {
        this.currentDrop = null;
        return;
      }
      const nextLayout = movePane(this.layout, state.paneId, drop);
      if (nextLayout) {
        this.layout = nextLayout;
        this.render();
        this.persistLayout();
      }
    }
    this.currentDrop = null;
  }
}

export { STORAGE_KEY };
