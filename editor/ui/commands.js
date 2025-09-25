const RESERVED_TYPES = new Set(['command', 'separator']);

function normalizeMenuId(id) {
  if (typeof id !== 'string' || !id.trim()) {
    throw new Error('[CommandRegistry] Menu id must be a non-empty string');
  }
  return id.trim().toLowerCase();
}

function normalizeCommandId(id) {
  if (typeof id !== 'string' || !id.trim()) {
    throw new Error('[CommandRegistry] Command id must be a non-empty string');
  }
  return id.trim().toLowerCase();
}

function normalizeShortcut(input) {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input
      .map(item => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
  }
  if (typeof input === 'string') {
    const trimmed = input.trim();
    return trimmed ? [trimmed] : [];
  }
  return [];
}

function shallowCloneCommand(command) {
  return {
    ...command,
    shortcuts: command.shortcuts.slice(),
  };
}

export class CommandRegistry {
  constructor() {
    this.menus = new Map();
    this.commands = new Map();
    this.listeners = new Set();
  }

  registerMenu({ id, title, order = 0 } = {}) {
    const key = normalizeMenuId(id);
    const menu = {
      id: key,
      title: typeof title === 'string' && title.trim() ? title.trim() : id,
      order: Number.isFinite(order) ? order : 0,
    };
    this.menus.set(key, menu);
    this._emit();
    return () => {
      if (this.menus.get(key) === menu) {
        this.menus.delete(key);
        this._emit();
      }
    };
  }

  registerCommand(definition = {}) {
    const id = normalizeCommandId(definition.id);
    if (this.commands.has(id)) {
      throw new Error(`[CommandRegistry] Command "${id}" already exists`);
    }

    const menuId = definition.menu ? normalizeMenuId(definition.menu) : null;
    if (menuId && !this.menus.has(menuId)) {
      this.registerMenu({ id: menuId, title: definition.menuTitle ?? definition.menu });
    }

    const type = RESERVED_TYPES.has(definition.type) ? definition.type : 'command';
    const command = {
      id,
      type,
      title: typeof definition.title === 'string' ? definition.title : '',
      menu: menuId,
      order: Number.isFinite(definition.order) ? definition.order : 0,
      enabled: definition.enabled !== false,
      checked: Boolean(definition.checked),
      description: typeof definition.description === 'string' ? definition.description : '',
      allowInInputs: Boolean(definition.allowInInputs),
      preventDefault: definition.preventDefault !== false,
      shortcuts: normalizeShortcut(definition.shortcut),
      run: typeof definition.run === 'function' ? definition.run : null,
    };

    this.commands.set(id, command);
    this._emit();

    return () => {
      if (this.commands.get(id) === command) {
        this.commands.delete(id);
        this._emit();
      }
    };
  }

  updateCommand(id, patch = {}) {
    const key = normalizeCommandId(id);
    const existing = this.commands.get(key);
    if (!existing) return;
    const next = shallowCloneCommand(existing);

    if (Object.prototype.hasOwnProperty.call(patch, 'title')) {
      next.title = typeof patch.title === 'string' ? patch.title : existing.title;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'enabled')) {
      next.enabled = Boolean(patch.enabled);
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'checked')) {
      next.checked = Boolean(patch.checked);
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'description')) {
      next.description = typeof patch.description === 'string' ? patch.description : existing.description;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'allowInInputs')) {
      next.allowInInputs = Boolean(patch.allowInInputs);
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'preventDefault')) {
      next.preventDefault = Boolean(patch.preventDefault);
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'shortcut')) {
      next.shortcuts = normalizeShortcut(patch.shortcut);
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'run')) {
      next.run = typeof patch.run === 'function' ? patch.run : existing.run;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'menu')) {
      const menuId = patch.menu ? normalizeMenuId(patch.menu) : null;
      next.menu = menuId;
      if (menuId && !this.menus.has(menuId)) {
        this.registerMenu({ id: menuId, title: patch.menuTitle ?? patch.menu });
      }
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'order')) {
      next.order = Number.isFinite(patch.order) ? patch.order : existing.order;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'type') && RESERVED_TYPES.has(patch.type)) {
      next.type = patch.type;
    }

    this.commands.set(key, next);
    this._emit();
  }

  setEnabled(id, value) {
    this.updateCommand(id, { enabled: Boolean(value) });
  }

  setChecked(id, value) {
    this.updateCommand(id, { checked: Boolean(value) });
  }

  execute(id, context) {
    const key = normalizeCommandId(id);
    const command = this.commands.get(key);
    if (!command || command.type !== 'command' || !command.enabled) {
      return undefined;
    }
    if (typeof command.run !== 'function') {
      return undefined;
    }
    try {
      return command.run({ id: command.id, ...context });
    } catch (err) {
      console.error(`[CommandRegistry] Failed to execute command "${command.id}"`, err);
      return undefined;
    }
  }

  getMenus() {
    return Array.from(this.menus.values())
      .slice()
      .sort((a, b) => {
        if (a.order === b.order) {
          return a.title.localeCompare(b.title);
        }
        return a.order - b.order;
      });
  }

  getCommands(menuId) {
    const key = menuId ? normalizeMenuId(menuId) : null;
    return Array.from(this.commands.values())
      .filter(cmd => cmd.menu === key)
      .sort((a, b) => {
        if (a.order === b.order) {
          return a.title.localeCompare(b.title);
        }
        return a.order - b.order;
      });
  }

  getCommand(id) {
    const key = normalizeCommandId(id);
    const command = this.commands.get(key);
    return command ? shallowCloneCommand(command) : null;
  }

  subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  _emit() {
    if (!this.listeners.size) return;
    for (const listener of this.listeners) {
      try {
        listener(this);
      } catch (err) {
        console.error('[CommandRegistry] Listener error', err);
      }
    }
  }
}

export default CommandRegistry;
