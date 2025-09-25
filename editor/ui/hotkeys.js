const MAC_PLATFORM = /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');

const MODIFIER_KEYS = new Set(['ctrl', 'shift', 'alt', 'meta']);

function normalizeKey(key) {
  if (!key) return '';
  const normalized = key.length === 1 ? key.toLowerCase() : key.toLowerCase();
  return normalized;
}

function parseShortcut(shortcut) {
  if (typeof shortcut !== 'string' || !shortcut.trim()) return null;
  const parts = shortcut.split('+').map(part => part.trim()).filter(Boolean);
  if (!parts.length) return null;

  const config = {
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    key: '',
    code: '',
  };

  for (const partRaw of parts) {
    const part = partRaw.toLowerCase();
    if (part === 'mod') {
      if (MAC_PLATFORM) config.metaKey = true;
      else config.ctrlKey = true;
      continue;
    }
    if (part === 'cmd' || part === 'command') {
      config.metaKey = true;
      continue;
    }
    if (part === 'ctrl' || part === 'control') {
      config.ctrlKey = true;
      continue;
    }
    if (part === 'shift') {
      config.shiftKey = true;
      continue;
    }
    if (part === 'alt' || part === 'option') {
      config.altKey = true;
      continue;
    }
    if (part.startsWith('f') && part.length <= 3 && !Number.isNaN(Number(part.slice(1)))) {
      config.key = part;
      config.code = part.toUpperCase();
      continue;
    }
    config.key = normalizeKey(partRaw);
  }

  if (!config.key) {
    const last = parts[parts.length - 1];
    if (last && !MODIFIER_KEYS.has(last.toLowerCase())) {
      config.key = normalizeKey(last);
    }
  }

  return config.key ? config : null;
}

function isEditableTarget(target) {
  if (!target) return false;
  const tag = target.tagName;
  if (!tag) return false;
  const lower = tag.toLowerCase();
  if (lower === 'input' || lower === 'textarea' || lower === 'select') return true;
  if (target.isContentEditable) return true;
  return target.closest?.('[contenteditable="true"]');
}

export function isMacPlatform() {
  return MAC_PLATFORM;
}

export function formatShortcut(shortcut) {
  if (!shortcut) return '';
  const tokens = shortcut.split('+').map(token => token.trim()).filter(Boolean);
  if (!tokens.length) return '';
  const formatted = [];
  if (MAC_PLATFORM) {
    for (const tokenRaw of tokens) {
      const token = tokenRaw.toLowerCase();
      if (token === 'mod' || token === 'cmd' || token === 'command') formatted.push('⌘');
      else if (token === 'shift') formatted.push('⇧');
      else if (token === 'ctrl' || token === 'control') formatted.push('⌃');
      else if (token === 'alt' || token === 'option') formatted.push('⌥');
      else formatted.push(tokenRaw.toUpperCase());
    }
    return formatted.join('');
  }
  return tokens
    .map(token => {
      const lower = token.toLowerCase();
      if (lower === 'mod') return 'Ctrl';
      if (lower === 'cmd' || lower === 'command') return 'Ctrl';
      if (lower === 'ctrl' || lower === 'control') return 'Ctrl';
      if (lower === 'shift') return 'Shift';
      if (lower === 'alt' || lower === 'option') return 'Alt';
      return token.length === 1 ? token.toUpperCase() : token;
    })
    .join('+');
}

export class HotkeyManager {
  constructor(registry, { target = window } = {}) {
    this.registry = registry;
    this.target = target;
    this._bindings = new Map();

    this._handleKeyDown = event => this._onKeyDown(event);
    this._unsubscribe = this.registry.subscribe(() => this._rebuild());

    this._attach();
    this._rebuild();
  }

  dispose() {
    this._detach();
    if (typeof this._unsubscribe === 'function') {
      this._unsubscribe();
    }
  }

  _attach() {
    if (this.target && typeof this.target.addEventListener === 'function') {
      this.target.addEventListener('keydown', this._handleKeyDown, { capture: true });
    }
  }

  _detach() {
    if (this.target && typeof this.target.removeEventListener === 'function') {
      this.target.removeEventListener('keydown', this._handleKeyDown, { capture: true });
    }
  }

  _rebuild() {
    this._bindings.clear();
    const menus = this.registry.getMenus();
    for (const menu of menus) {
      const commands = this.registry.getCommands(menu.id);
      for (const command of commands) {
        if (!command.shortcuts?.length) continue;
        for (const shortcut of command.shortcuts) {
          const parsed = parseShortcut(shortcut);
          if (!parsed) continue;
          const key = parsed.key;
          if (!this._bindings.has(key)) {
            this._bindings.set(key, []);
          }
          this._bindings.get(key).push({
            commandId: command.id,
            config: parsed,
          });
        }
      }
    }
  }

  _matches(event, config) {
    if (!config) return false;
    const eventKey = normalizeKey(event.key || event.code);
    if (eventKey !== config.key && event.code?.toLowerCase() !== config.key) {
      return false;
    }
    if (config.ctrlKey !== event.ctrlKey) return false;
    if (config.metaKey !== event.metaKey) return false;
    if (config.altKey !== event.altKey) return false;
    if (config.shiftKey !== event.shiftKey) return false;
    return true;
  }

  _onKeyDown(event) {
    if (!event || event.defaultPrevented) return;
    const key = normalizeKey(event.key || event.code);
    if (!key) return;
    const candidates = this._bindings.get(key);
    if (!candidates || !candidates.length) return;

    for (const candidate of candidates) {
      const { commandId, config } = candidate;
      if (!this._matches(event, config)) continue;
      const command = this.registry.getCommand(commandId);
      if (!command || command.type !== 'command' || !command.enabled) continue;
      if (!command.allowInInputs && isEditableTarget(event.target)) {
        continue;
      }
      if (command.preventDefault !== false) {
        event.preventDefault();
      }
      this.registry.execute(command.id, { source: 'hotkey', event });
      break;
    }
  }
}

export default HotkeyManager;
