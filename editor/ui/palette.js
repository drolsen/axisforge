import { formatShortcut } from './hotkeys.js';

const TYPE_CONFIG = {
  command: { label: 'Commands', weight: 220 },
  node: { label: 'Nodes', weight: 140 },
  asset: { label: 'Assets', weight: 120 },
};

function escapeHtml(text = '') {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function highlightMatch(text, query) {
  if (!query) {
    return escapeHtml(text);
  }
  const lower = String(text).toLowerCase();
  const needle = query.toLowerCase();
  const index = lower.indexOf(needle);
  if (index === -1) {
    return escapeHtml(text);
  }
  const before = text.slice(0, index);
  const match = text.slice(index, index + query.length);
  const after = text.slice(index + query.length);
  return `${escapeHtml(before)}<mark>${escapeHtml(match)}</mark>${escapeHtml(after)}`;
}

function computeFuzzyScore(query, target) {
  if (!query) {
    return 0;
  }
  const haystack = target.toLowerCase();
  const needle = query.toLowerCase();
  let score = 0;
  let lastIndex = -1;
  for (let i = 0; i < needle.length; i += 1) {
    const char = needle[i];
    const index = haystack.indexOf(char, lastIndex + 1);
    if (index === -1) {
      return null;
    }
    if (index === lastIndex + 1) {
      score += 8;
    } else {
      score += Math.max(1, 6 - (index - lastIndex));
    }
    score -= index * 0.05;
    lastIndex = index;
  }
  score -= Math.max(0, haystack.length - needle.length) * 0.02;
  return score;
}

function buildNodePath(node) {
  const parts = [];
  let current = node?.Parent ?? null;
  let safety = 0;
  while (current && safety < 64) {
    const label = current.Name ?? current.ClassName ?? 'Instance';
    parts.push(label);
    current = current.Parent ?? null;
    safety += 1;
  }
  return parts.reverse().join(' / ');
}

function normalizeAssetName(asset) {
  return asset?.name || asset?.logicalPath || asset?.guid || 'Asset';
}

export default class CommandPalette {
  constructor({ registry = null, explorer = null, assets = null, shell = null } = {}) {
    this.registry = registry;
    this.explorer = explorer;
    this.assets = assets;
    this.shell = shell;

    this.items = [];
    this.visibleItems = [];
    this.activeIndex = 0;
    this.query = '';
    this.isOpen = false;

    this._registryUnsubscribe = null;

    this._buildUI();

    if (this.registry?.subscribe) {
      this._registryUnsubscribe = this.registry.subscribe(() => {
        if (this.isOpen) {
          this._rebuildIndex();
          this._filter();
        }
      });
    }
  }

  dispose() {
    if (this._registryUnsubscribe) {
      this._registryUnsubscribe();
      this._registryUnsubscribe = null;
    }
    if (this.container && this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
  }

  setExplorer(explorer) {
    this.explorer = explorer;
  }

  setAssets(assets) {
    this.assets = assets;
  }

  setShell(shell) {
    this.shell = shell;
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this._rebuildIndex();
    this.query = '';
    this.input.value = '';
    this.activeIndex = 0;
    this._filter();
    this.container.classList.add('is-visible');
    window.requestAnimationFrame(() => {
      this.input.focus({ preventScroll: true });
      this.input.select();
    });
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.container.classList.remove('is-visible');
    this.visibleItems = [];
    this._renderResults();
  }

  _buildUI() {
    this.container = document.createElement('div');
    this.container.className = 'command-palette';

    this.panel = document.createElement('div');
    this.panel.className = 'command-palette__panel';

    this.input = document.createElement('input');
    this.input.type = 'search';
    this.input.className = 'command-palette__input';
    this.input.placeholder = 'Search commands, nodes, and assets…';

    this.results = document.createElement('div');
    this.results.className = 'command-palette__results';

    this.empty = document.createElement('div');
    this.empty.className = 'command-palette__empty';
    this.empty.textContent = 'No results';

    this.panel.append(this.input, this.results, this.empty);
    this.container.appendChild(this.panel);
    document.body.appendChild(this.container);

    this.container.addEventListener('pointerdown', event => {
      if (event.target === this.container) {
        this.close();
      }
    });

    this.input.addEventListener('input', () => {
      this.query = this.input.value.trim();
      this._filter();
    });

    this.input.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        this._moveSelection(1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        this._moveSelection(-1);
      } else if (event.key === 'Home') {
        event.preventDefault();
        this._moveSelection('start');
      } else if (event.key === 'End') {
        event.preventDefault();
        this._moveSelection('end');
      } else if (event.key === 'Enter') {
        event.preventDefault();
        this._activate({ openContextMenu: event.shiftKey });
      } else if (event.key === 'Escape') {
        event.preventDefault();
        this.close();
      }
    });

    this.results.addEventListener('pointermove', event => {
      const item = event.target.closest('.command-palette__item');
      if (!item) return;
      const index = Number(item.dataset.index ?? '-1');
      if (Number.isFinite(index) && index !== this.activeIndex) {
        this.activeIndex = index;
        this._highlightActive();
      }
    });

    this.results.addEventListener('mousedown', event => {
      event.preventDefault();
    });

    this.results.addEventListener('click', event => {
      const item = event.target.closest('.command-palette__item');
      if (!item) return;
      const index = Number(item.dataset.index ?? '-1');
      if (!Number.isFinite(index) || index < 0 || index >= this.visibleItems.length) {
        return;
      }
      this.activeIndex = index;
      this._highlightActive();
      this._activate({ openContextMenu: event.shiftKey });
    });
  }

  _rebuildIndex() {
    this.items = [];
    if (this.registry) {
      this.items.push(...this._collectCommands());
    }
    if (this.explorer) {
      this.items.push(...this._collectNodes());
    }
    if (this.assets) {
      this.items.push(...this._collectAssets());
    }
  }

  _collectCommands() {
    if (!this.registry) return [];
    const items = [];
    const menus = this.registry.getMenus?.() ?? [];
    const menuTitles = new Map();
    for (const menu of menus) {
      menuTitles.set(menu.id, menu.title);
    }
    const appendCommands = (commandList, menuId = null) => {
      for (const command of commandList) {
        if (!command || command.type !== 'command') continue;
        const shortcuts = Array.isArray(command.shortcuts) ? command.shortcuts : [];
        const shortcut = shortcuts.length ? formatShortcut(shortcuts[0]) : '';
        const menuTitle = command.menu ? menuTitles.get(command.menu) || '' : (menuId === null ? '' : menuTitles.get(menuId) || '');
        const label = command.title || command.id;
        const description = command.description || menuTitle || '';
        items.push({
          type: 'command',
          label,
          subtitle: description,
          meta: shortcut,
          searchText: `${label} ${command.id} ${description} ${(menuTitle || '')}`.toLowerCase(),
          weight: TYPE_CONFIG.command.weight,
          commandId: command.id,
          disabled: command.enabled === false,
        });
      }
    };
    for (const menu of menus) {
      const commands = this.registry.getCommands?.(menu.id) ?? [];
      appendCommands(commands, menu.id);
    }
    const standalone = this.registry.getCommands?.(null) ?? [];
    appendCommands(standalone, null);
    return items;
  }

  _collectNodes() {
    if (!this.explorer?.getAllNodes) return [];
    const nodes = this.explorer.getAllNodes();
    const items = [];
    for (const node of nodes) {
      if (!node) continue;
      const label = node.Name ?? node.ClassName ?? 'Instance';
      const path = buildNodePath(node);
      const className = node.ClassName ?? '';
      items.push({
        type: 'node',
        label,
        subtitle: path,
        meta: className,
        searchText: `${label} ${className} ${path}`.toLowerCase(),
        weight: TYPE_CONFIG.node.weight,
        node,
      });
    }
    return items;
  }

  _collectAssets() {
    if (!this.assets?.getAssetEntries) return [];
    const entries = this.assets.getAssetEntries();
    const items = [];
    for (const asset of entries) {
      if (!asset) continue;
      const label = normalizeAssetName(asset);
      const type = asset.type || '';
      const path = asset.logicalPath || '';
      items.push({
        type: 'asset',
        label,
        subtitle: path,
        meta: type ? type.charAt(0).toUpperCase() + type.slice(1) : '',
        searchText: `${label} ${type} ${path}`.toLowerCase(),
        weight: TYPE_CONFIG.asset.weight,
        asset,
      });
    }
    return items;
  }

  _filter() {
    const query = this.query.toLowerCase();
    let matches = [];
    if (!query) {
      matches = [...this.items].sort((a, b) => {
        if (b.weight === a.weight) {
          return a.label.localeCompare(b.label);
        }
        return b.weight - a.weight;
      });
    } else {
      const scored = [];
      for (const item of this.items) {
        const score = computeFuzzyScore(query, item.searchText ?? item.label ?? '');
        if (score === null) continue;
        scored.push({ item, score: score + (item.weight ?? 0) });
      }
      scored.sort((a, b) => {
        if (b.score === a.score) {
          return a.item.label.localeCompare(b.item.label);
        }
        return b.score - a.score;
      });
      matches = scored.map(entry => entry.item);
    }
    const limit = 60;
    this.visibleItems = matches.slice(0, limit);
    if (this.activeIndex >= this.visibleItems.length) {
      this.activeIndex = Math.max(0, this.visibleItems.length - 1);
    }
    this._renderResults();
    this._highlightActive();
  }

  _renderResults() {
    this.results.textContent = '';
    if (!this.visibleItems.length) {
      this.results.hidden = true;
      this.empty.hidden = false;
      return;
    }
    this.results.hidden = false;
    this.empty.hidden = true;

    let index = 0;
    let lastType = null;
    for (const item of this.visibleItems) {
      if (item.type !== lastType) {
        lastType = item.type;
        const header = document.createElement('div');
        header.className = 'command-palette__section';
        header.textContent = TYPE_CONFIG[item.type]?.label ?? item.type;
        this.results.appendChild(header);
      }
      const row = document.createElement('div');
      row.className = 'command-palette__item';
      row.dataset.index = String(index);
      if (item.disabled) {
        row.classList.add('is-disabled');
      }

      const textWrap = document.createElement('div');
      textWrap.className = 'command-palette__item-text';
      const label = document.createElement('div');
      label.className = 'command-palette__item-label';
      label.innerHTML = highlightMatch(item.label ?? '', this.query);
      textWrap.appendChild(label);
      if (item.subtitle) {
        const subtitle = document.createElement('div');
        subtitle.className = 'command-palette__item-subtitle';
        subtitle.innerHTML = highlightMatch(item.subtitle, this.query);
        textWrap.appendChild(subtitle);
      }

      const meta = document.createElement('div');
      meta.className = 'command-palette__item-meta';
      meta.textContent = item.meta ?? '';

      row.append(textWrap, meta);
      this.results.appendChild(row);
      index += 1;
    }
  }

  _highlightActive() {
    const rows = this.results.querySelectorAll('.command-palette__item');
    rows.forEach(row => {
      const index = Number(row.dataset.index ?? '-1');
      row.classList.toggle('is-active', index === this.activeIndex);
    });
    const activeRow = this.results.querySelector(`.command-palette__item[data-index="${this.activeIndex}"]`);
    if (activeRow) {
      activeRow.scrollIntoView({ block: 'nearest' });
    }
  }

  _moveSelection(direction) {
    if (!this.visibleItems.length) return;
    if (direction === 'start') {
      this.activeIndex = 0;
    } else if (direction === 'end') {
      this.activeIndex = this.visibleItems.length - 1;
    } else if (typeof direction === 'number' && Number.isFinite(direction)) {
      const next = this.activeIndex + direction;
      if (next < 0) {
        this.activeIndex = this.visibleItems.length - 1;
      } else if (next >= this.visibleItems.length) {
        this.activeIndex = 0;
      } else {
        this.activeIndex = next;
      }
    }
    this._highlightActive();
  }

  _activate({ openContextMenu = false } = {}) {
    if (!this.visibleItems.length) return;
    const item = this.visibleItems[this.activeIndex];
    if (!item) return;
    if (item.disabled) {
      return;
    }
    this.close();
    if (item.type === 'command') {
      this.registry?.execute?.(item.commandId, { source: 'palette' });
    } else if (item.type === 'node') {
      if (this.shell?.activatePane) {
        this.shell.activatePane('explorer');
      }
      this.explorer?.focusNode?.(item.node, { openContextMenu });
    } else if (item.type === 'asset') {
      if (this.shell?.activatePane) {
        this.shell.activatePane('assets');
      }
      this.assets?.focusAsset?.(item.asset, { openContextMenu });
    }
  }
}
