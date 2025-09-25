let nodeIdCounter = 0;

function defaultGetChildren(node) {
  if (!node) return [];
  if (typeof node.GetChildren === 'function') {
    return node.GetChildren();
  }
  if (Array.isArray(node.Children)) {
    return node.Children;
  }
  return [];
}

function defaultGetLabel(node) {
  if (!node) return '';
  if (typeof node.getLabel === 'function') return node.getLabel();
  return node.Name ?? node.ClassName ?? '';
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderHighlightedText(element, text, filter) {
  if (!filter) {
    element.textContent = text;
    return;
  }
  const lower = text.toLowerCase();
  const idx = lower.indexOf(filter.toLowerCase());
  if (idx === -1) {
    element.textContent = text;
    return;
  }
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + filter.length);
  const after = text.slice(idx + filter.length);
  element.innerHTML = `${escapeHtml(before)}<mark class="virtual-tree__highlight">${escapeHtml(match)}</mark>${escapeHtml(after)}`;
}

class VirtualTree {
  constructor(hostElement, options = {}) {
    this.hostElement = hostElement;
    this.options = options;
    this.rowHeight = options.rowHeight ?? 22;
    this.indent = options.indent ?? 14;
    this.multiSelect = options.multiSelect !== false;
    this.getChildren = options.getChildren ?? defaultGetChildren;
    this.getLabel = options.getLabel ?? defaultGetLabel;
    this.getIcon = options.getIcon ?? (() => null);
    this.getId = options.getId ?? (node => {
      if (!node) return null;
      if (!node.__virtualTreeId) {
        Object.defineProperty(node, '__virtualTreeId', {
          value: `node-${nodeIdCounter += 1}`,
          enumerable: false,
          configurable: false,
          writable: false,
        });
      }
      return node.__virtualTreeId;
    });
    this.isExpandable = options.isExpandable ?? (node => this.getChildren(node).length > 0);

    this.roots = [];
    this.visibleEntries = [];
    this.expanded = new Set();
    this.selection = [];
    this.selectionSet = new Set();
    this.anchorId = null;
    this.focusedId = null;
    this.filterText = '';
    this.filterMatches = new Set();
    this._rowPool = [];
    this._rowToEntry = new Map();
    this._events = new EventTarget();
    this._dragState = null;
    this._pressState = null;

    this.viewport = document.createElement('div');
    this.viewport.className = 'virtual-tree';
    this.viewport.tabIndex = 0;
    this.content = document.createElement('div');
    this.content.className = 'virtual-tree__content';
    this.viewport.appendChild(this.content);
    this.hostElement.appendChild(this.viewport);

    this.dropIndicator = document.createElement('div');
    this.dropIndicator.className = 'virtual-tree__drop-indicator';
    this.viewport.appendChild(this.dropIndicator);
    this.dropIndicator.hidden = true;

    this._boundRender = () => this._render();
    this._boundPointerMove = event => this._handlePointerMove(event);
    this._boundPointerUp = event => this._handlePointerUp(event);
    this._boundPointerCancel = event => this._handlePointerCancel(event);

    this.viewport.addEventListener('scroll', this._boundRender);
    this.viewport.addEventListener('click', event => this._handleClick(event));
    this.viewport.addEventListener('dblclick', event => this._handleDoubleClick(event));
    this.viewport.addEventListener('keydown', event => this._handleKeyDown(event));
    this.viewport.addEventListener('pointerdown', event => this._handlePointerDown(event));

    this.resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this._render());
      this.resizeObserver.observe(this.viewport);
    } else {
      window.addEventListener('resize', this._boundRender);
    }
  }

  dispose() {
    this.viewport.removeEventListener('scroll', this._boundRender);
    this.viewport.remove();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    } else {
      window.removeEventListener('resize', this._boundRender);
    }
  }

  on(eventName, callback) {
    const handler = evt => callback?.(evt.detail);
    this._events.addEventListener(eventName, handler);
    return () => this._events.removeEventListener(eventName, handler);
  }

  emit(eventName, detail = {}) {
    this._events.dispatchEvent(new CustomEvent(eventName, { detail }));
  }

  setData(roots = []) {
    this.roots = Array.isArray(roots) ? roots : [];
    this.visibleEntries = [];
    this.expanded.clear();
    for (const root of this.roots) {
      if (root) this.expanded.add(this.getId(root));
    }
    this.refresh();
  }

  refresh() {
    this._buildVisibleEntries();
    this._updateFilterMatches();
    this._render();
  }

  setFilter(text) {
    this.filterText = (text ?? '').trim();
    this._updateFilterMatches();
    this._render();
  }

  setSelection(nodes, { anchor } = {}) {
    const list = Array.isArray(nodes) ? nodes.filter(Boolean) : [];
    this.selection = list;
    this.selectionSet = new Set(list);
    const anchorNode = anchor ?? list[0] ?? null;
    this.anchorId = anchorNode ? this.getId(anchorNode) : null;
    this.focusedId = this.anchorId;
    this._render();
  }

  getSelection() {
    return [...this.selection];
  }

  toggle(node) {
    if (!node) return;
    const id = this.getId(node);
    if (this.expanded.has(id)) {
      this.expanded.delete(id);
    } else {
      this.expanded.add(id);
    }
    this.refresh();
  }

  expand(node, recursive = false) {
    if (!node) return;
    const id = this.getId(node);
    this.expanded.add(id);
    if (recursive) {
      for (const child of this.getChildren(node)) {
        this.expand(child, true);
      }
    }
    this.refresh();
  }

  collapse(node, recursive = false) {
    if (!node) return;
    const id = this.getId(node);
    this.expanded.delete(id);
    if (recursive) {
      for (const child of this.getChildren(node)) {
        this.collapse(child, true);
      }
    }
    this.refresh();
  }

  expandPathTo(node) {
    if (!node) return;
    let current = node.Parent ?? null;
    while (current) {
      this.expanded.add(this.getId(current));
      current = current.Parent ?? null;
    }
    this.refresh();
  }

  scrollTo(node) {
    if (!node) return;
    const id = this.getId(node);
    const entry = this.visibleEntries.find(item => this.getId(item.node) === id);
    if (!entry) return;
    const top = entry.index * this.rowHeight;
    const bottom = top + this.rowHeight;
    const scrollTop = this.viewport.scrollTop;
    const height = this.viewport.clientHeight;
    if (top < scrollTop) {
      this.viewport.scrollTop = top;
    } else if (bottom > scrollTop + height) {
      this.viewport.scrollTop = bottom - height;
    }
    this._render();
  }

  beginRename(node) {
    if (!node) return;
    this.expandPathTo(node);
    this.scrollTo(node);
    requestAnimationFrame(() => {
      this._startInlineRename(node);
    });
  }

  getEntryFromElement(element) {
    const row = element?.closest('.virtual-tree__row');
    if (!row) return null;
    return this._rowToEntry.get(row) ?? null;
  }

  _buildVisibleEntries() {
    this.visibleEntries = [];
    const pushNode = (node, depth, parent = null) => {
      if (!node) return;
      const id = this.getId(node);
      const children = this.getChildren(node) || [];
      const entry = {
        node,
        id,
        depth,
        parent,
        hasChildren: Boolean(children.length),
        index: this.visibleEntries.length,
      };
      this.visibleEntries.push(entry);
      if (entry.hasChildren && this.expanded.has(id)) {
        for (const child of children) {
          pushNode(child, depth + 1, node);
        }
      }
    };

    for (const root of this.roots) {
      pushNode(root, 0, null);
    }
  }

  _updateFilterMatches() {
    this.filterMatches = new Set();
    const filter = this.filterText.toLowerCase();
    if (!filter) return;
    const visit = node => {
      if (!node) return;
      const label = (this.getLabel(node) ?? '').toLowerCase();
      if (label.includes(filter)) {
        this.filterMatches.add(this.getId(node));
      }
      for (const child of this.getChildren(node)) {
        visit(child);
      }
    };
    for (const root of this.roots) {
      visit(root);
    }
  }

  _ensureRowPool(count) {
    while (this._rowPool.length < count) {
      const row = document.createElement('div');
      row.className = 'virtual-tree__row';
      row.style.height = `${this.rowHeight}px`;
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'virtual-tree__toggle';
      const icon = document.createElement('span');
      icon.className = 'virtual-tree__icon';
      const label = document.createElement('span');
      label.className = 'virtual-tree__label';
      row.append(toggle, icon, label);
      this.content.appendChild(row);
      this._rowPool.push(row);
    }
  }

  _render() {
    const total = this.visibleEntries.length;
    this.content.style.height = `${Math.max(0, total * this.rowHeight)}px`;
    const viewportHeight = this.viewport.clientHeight || 0;
    const scrollTop = this.viewport.scrollTop || 0;
    const startIndex = Math.max(0, Math.floor(scrollTop / this.rowHeight) - 2);
    const endIndex = Math.min(total, Math.ceil((scrollTop + viewportHeight) / this.rowHeight) + 2);
    const needed = Math.max(0, endIndex - startIndex);

    this._ensureRowPool(needed);
    this._rowToEntry.clear();

    for (let i = 0; i < this._rowPool.length; i += 1) {
      const row = this._rowPool[i];
      if (i < needed) {
        const entry = this.visibleEntries[startIndex + i];
        this._updateRow(row, entry);
        row.style.display = '';
        row.style.transform = `translateY(${(startIndex + i) * this.rowHeight}px)`;
        this._rowToEntry.set(row, entry);
      } else {
        row.style.display = 'none';
        this._rowToEntry.delete(row);
      }
    }
  }

  _updateRow(row, entry) {
    const { node, depth, hasChildren } = entry;
    row.style.paddingLeft = `${8 + depth * this.indent}px`;
    row.dataset.nodeId = entry.id;
    row.dataset.depth = String(depth);
    row.classList.toggle('is-selected', this.selectionSet.has(node));
    row.classList.toggle('is-focused', this.focusedId === entry.id && this.viewport === document.activeElement);
    row.classList.toggle('has-children', hasChildren);
    row.classList.toggle('has-match', this.filterMatches.has(entry.id));

    const [toggle, iconEl, labelEl] = row.children;
    if (toggle) {
      toggle.hidden = !hasChildren;
      toggle.setAttribute('aria-hidden', hasChildren ? 'false' : 'true');
      toggle.classList.toggle('is-expanded', this.expanded.has(entry.id));
    }

    if (iconEl) {
      const iconClass = this.getIcon(node);
      iconEl.className = 'virtual-tree__icon';
      if (iconClass) {
        iconEl.classList.add('icon', iconClass);
      }
    }

    const labelText = this.getLabel(node) ?? '';
    renderHighlightedText(labelEl, labelText, this.filterText);
  }

  _handleClick(event) {
    if (event.defaultPrevented) return;
    const row = event.target.closest('.virtual-tree__row');
    if (!row) return;
    const entry = this._rowToEntry.get(row);
    if (!entry) return;

    if (event.target.closest('.virtual-tree__toggle')) {
      this.toggle(entry.node);
      return;
    }

    const { ctrlKey, metaKey, shiftKey } = event;
    this._applySelection(entry, { additive: ctrlKey || metaKey, toggle: ctrlKey || metaKey, range: shiftKey });
    this.emit('selectionchange', { selection: this.getSelection() });
    this.viewport.focus({ preventScroll: true });
  }

  _applySelection(entry, { additive = false, toggle = false, range = false } = {}) {
    if (!entry) return;
    const node = entry.node;
    if (range && this.anchorId) {
      const anchorIndex = this.visibleEntries.findIndex(item => this.getId(item.node) === this.anchorId);
      const currentIndex = entry.index;
      if (anchorIndex !== -1) {
        const [start, end] = anchorIndex < currentIndex
          ? [anchorIndex, currentIndex]
          : [currentIndex, anchorIndex];
        const rangeNodes = [];
        for (let i = start; i <= end; i += 1) {
          rangeNodes.push(this.visibleEntries[i].node);
        }
        this.selection = rangeNodes;
        this.selectionSet = new Set(rangeNodes);
        this.focusedId = entry.id;
        return;
      }
    }

    if (toggle && this.selectionSet.has(node)) {
      this.selection = this.selection.filter(item => item !== node);
      this.selectionSet.delete(node);
      this.focusedId = entry.id;
      if (this.selection.length === 0) {
        this.anchorId = null;
      }
      this._render();
      return;
    }

    if (additive) {
      if (!this.selectionSet.has(node)) {
        this.selection.push(node);
        this.selectionSet.add(node);
      }
    } else {
      this.selection = [node];
      this.selectionSet = new Set([node]);
    }
    this.anchorId = this.getId(node);
    this.focusedId = this.anchorId;
    this._render();
  }

  _handleDoubleClick(event) {
    const row = event.target.closest('.virtual-tree__row');
    if (!row) return;
    const entry = this._rowToEntry.get(row);
    if (!entry) return;
    if (entry.hasChildren) {
      this.toggle(entry.node);
    }
  }

  _handleKeyDown(event) {
    if (event.defaultPrevented) return;
    const key = event.key;
    if (key === 'ArrowDown') {
      event.preventDefault();
      this._moveFocus(1, event.shiftKey);
    } else if (key === 'ArrowUp') {
      event.preventDefault();
      this._moveFocus(-1, event.shiftKey);
    } else if (key === 'ArrowLeft') {
      event.preventDefault();
      this._handleCollapseKey();
    } else if (key === 'ArrowRight') {
      event.preventDefault();
      this._handleExpandKey();
    } else if (key === 'Home') {
      event.preventDefault();
      this._moveFocusToIndex(0, event.shiftKey);
    } else if (key === 'End') {
      event.preventDefault();
      this._moveFocusToIndex(this.visibleEntries.length - 1, event.shiftKey);
    } else if (key === 'a' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      this.selection = this.visibleEntries.map(entry => entry.node);
      this.selectionSet = new Set(this.selection);
      this.anchorId = this.selection.length ? this.getId(this.selection[0]) : null;
      this.focusedId = this.anchorId;
      this._render();
      this.emit('selectionchange', { selection: this.getSelection() });
    } else if (key === 'F2') {
      event.preventDefault();
      const node = this.selection[0];
      if (node) this.beginRename(node);
    } else if (key === 'Delete' || key === 'Backspace') {
      event.preventDefault();
      this.emit('delete', { selection: this.getSelection() });
    }
  }

  _moveFocus(delta, extendSelection) {
    if (!this.visibleEntries.length) return;
    let index = 0;
    if (this.focusedId) {
      const currentIndex = this.visibleEntries.findIndex(entry => entry.id === this.focusedId);
      index = currentIndex !== -1 ? currentIndex + delta : 0;
    } else {
      index = delta > 0 ? 0 : this.visibleEntries.length - 1;
    }
    index = Math.max(0, Math.min(this.visibleEntries.length - 1, index));
    this._moveFocusToIndex(index, extendSelection);
  }

  _moveFocusToIndex(index, extendSelection) {
    if (index < 0 || index >= this.visibleEntries.length) return;
    const entry = this.visibleEntries[index];
    this.focusedId = entry.id;
    if (extendSelection) {
      this._applySelection(entry, { range: true });
    } else {
      this.selection = [entry.node];
      this.selectionSet = new Set(this.selection);
      this.anchorId = entry.id;
      this._render();
      this.emit('selectionchange', { selection: this.getSelection() });
    }
    this.scrollTo(entry.node);
  }

  _handleCollapseKey() {
    if (!this.focusedId) return;
    const entry = this.visibleEntries.find(item => item.id === this.focusedId);
    if (!entry) return;
    if (this.expanded.has(entry.id) && entry.hasChildren) {
      this.expanded.delete(entry.id);
      this.refresh();
    } else if (entry.parent) {
      this.focusedId = this.getId(entry.parent);
      this.anchorId = this.focusedId;
      this.selection = [entry.parent];
      this.selectionSet = new Set(this.selection);
      this.scrollTo(entry.parent);
      this._render();
      this.emit('selectionchange', { selection: this.getSelection() });
    }
  }

  _handleExpandKey() {
    if (!this.focusedId) return;
    const entry = this.visibleEntries.find(item => item.id === this.focusedId);
    if (!entry) return;
    if (entry.hasChildren) {
      if (!this.expanded.has(entry.id)) {
        this.expanded.add(entry.id);
        this.refresh();
      } else {
        const children = this.getChildren(entry.node);
        if (children.length) {
          this.focusedId = this.getId(children[0]);
          this.anchorId = this.focusedId;
          this.selection = [children[0]];
          this.selectionSet = new Set(this.selection);
          this.scrollTo(children[0]);
          this._render();
          this.emit('selectionchange', { selection: this.getSelection() });
        }
      }
    }
  }

  _startInlineRename(node) {
    const entry = this.visibleEntries.find(item => item.node === node);
    if (!entry) return;
    const row = [...this._rowToEntry.entries()].find(([, value]) => value === entry)?.[0];
    if (!row) return;
    const labelEl = row.querySelector('.virtual-tree__label');
    if (!labelEl) return;

    const currentText = this.getLabel(node) ?? '';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'virtual-tree__rename';
    input.value = currentText;
    input.addEventListener('keydown', evt => {
      if (evt.key === 'Enter') {
        evt.preventDefault();
        input.blur();
      } else if (evt.key === 'Escape') {
        evt.preventDefault();
        input.value = currentText;
        input.blur();
      }
    });
    input.addEventListener('blur', () => {
      labelEl.innerHTML = '';
      renderHighlightedText(labelEl, this.getLabel(node) ?? '', this.filterText);
      const nextName = input.value.trim();
      if (nextName && nextName !== currentText) {
        this.emit('rename', { node, name: nextName });
      }
    });
    labelEl.innerHTML = '';
    labelEl.appendChild(input);
    input.focus();
    input.select();
  }

  _handlePointerDown(event) {
    if (event.button !== 0) return;
    const row = event.target.closest('.virtual-tree__row');
    if (!row) return;
    const entry = this._rowToEntry.get(row);
    if (!entry) return;
    this._pressState = {
      entry,
      startX: event.clientX,
      startY: event.clientY,
    };
    window.addEventListener('pointermove', this._boundPointerMove, true);
    window.addEventListener('pointerup', this._boundPointerUp, true);
    window.addEventListener('pointercancel', this._boundPointerCancel, true);
  }

  _handlePointerMove(event) {
    if (!this._pressState) return;
    const dx = event.clientX - this._pressState.startX;
    const dy = event.clientY - this._pressState.startY;
    if (!this._dragState) {
      if (Math.hypot(dx, dy) > 4) {
        this._beginDrag(this._pressState.entry);
      } else {
        return;
      }
    }
    if (this._dragState) {
      this._updateDragTarget(event);
    }
  }

  _beginDrag(entry) {
    if (!entry) return;
    if (!this.selectionSet.has(entry.node)) {
      this.selection = [entry.node];
      this.selectionSet = new Set(this.selection);
      this.anchorId = entry.id;
      this.focusedId = entry.id;
      this._render();
      this.emit('selectionchange', { selection: this.getSelection() });
    }
    this._dragState = {
      nodes: this.getSelection(),
      target: null,
    };
    this.viewport.classList.add('is-dragging');
  }

  _updateDragTarget(event) {
    const rect = this.viewport.getBoundingClientRect();
    const offsetY = event.clientY - rect.top + this.viewport.scrollTop;
    if (!this.visibleEntries.length || offsetY < 0) {
      this._setDropTarget(null);
      return;
    }
    const index = Math.max(0, Math.min(this.visibleEntries.length - 1, Math.floor(offsetY / this.rowHeight)));
    const entry = this.visibleEntries[index];
    if (!entry) {
      this._setDropTarget(null);
      return;
    }
    this._setDropTarget(entry);
  }

  _setDropTarget(entry) {
    if (!this._dragState) return;
    if (!entry || this.selectionSet.has(entry.node)) {
      this.dropIndicator.hidden = true;
      this._dragState.target = null;
      return;
    }
    this._dragState.target = entry.node;
    this.dropIndicator.hidden = false;
    this.dropIndicator.style.top = `${(entry.index + 1) * this.rowHeight}px`;
  }

  _handlePointerUp() {
    if (this._dragState && this._dragState.target) {
      this.emit('drop', {
        nodes: this._dragState.nodes,
        target: this._dragState.target,
      });
    }
    this._cleanupPointerState();
  }

  _handlePointerCancel() {
    this._cleanupPointerState();
  }

  _cleanupPointerState() {
    this._pressState = null;
    this._dragState = null;
    this.dropIndicator.hidden = true;
    this.viewport.classList.remove('is-dragging');
    window.removeEventListener('pointermove', this._boundPointerMove, true);
    window.removeEventListener('pointerup', this._boundPointerUp, true);
    window.removeEventListener('pointercancel', this._boundPointerCancel, true);
  }
}

export default VirtualTree;
