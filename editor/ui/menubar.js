import { formatShortcut } from './hotkeys.js';

const MENU_CLASS = 'menubar__menu';
const OPEN_CLASS = 'is-open';

function createElement(tag, className) {
  const el = document.createElement(tag);
  if (className) {
    el.className = className;
  }
  return el;
}

function isMenuButton(target) {
  return target?.dataset?.menuButton === 'true';
}

function isCommandButton(target) {
  return target?.dataset?.commandId;
}

export class Menubar {
  constructor(registry) {
    this.registry = registry;
    this.element = createElement('nav', 'menubar');
    this._openMenuId = null;
    this._menuNodes = new Map();

    this._handleRegistryUpdate = () => this._render();
    this._handleDocumentClick = event => this._onDocumentClick(event);
    this._handleKeyDown = event => this._onKeyDown(event);
    this._handleWindowBlur = () => this.close();

    this.registry.subscribe(this._handleRegistryUpdate);
    document.addEventListener('click', this._handleDocumentClick);
    window.addEventListener('blur', this._handleWindowBlur);
    this.element.addEventListener('keydown', this._handleKeyDown);

    this._render();
  }

  dispose() {
    document.removeEventListener('click', this._handleDocumentClick);
    this.element.removeEventListener('keydown', this._handleKeyDown);
    window.removeEventListener('blur', this._handleWindowBlur);
  }

  close() {
    if (!this._openMenuId) return;
    const menu = this._menuNodes.get(this._openMenuId);
    if (menu) {
      menu.classList.remove(OPEN_CLASS);
      const dropdown = menu.querySelector('.menubar__dropdown');
      if (dropdown) dropdown.setAttribute('aria-hidden', 'true');
    }
    this._openMenuId = null;
  }

  _render() {
    const currentOpen = this._openMenuId;
    this._menuNodes.clear();
    this.element.textContent = '';

    const menus = this.registry.getMenus();
    for (const menu of menus) {
      const container = createElement('div', MENU_CLASS);
      container.dataset.menuId = menu.id;

      const button = createElement('button', 'menubar__item');
      button.type = 'button';
      button.dataset.menuButton = 'true';
      button.dataset.menuId = menu.id;
      button.textContent = menu.title;
      button.addEventListener('click', event => this._toggleMenu(menu.id, event));
      button.addEventListener('mouseenter', () => {
        if (this._openMenuId && this._openMenuId !== menu.id) {
          this._openSpecificMenu(menu.id, { focusButton: false });
        }
      });

      const dropdown = createElement('div', 'menubar__dropdown');
      dropdown.setAttribute('role', 'menu');
      dropdown.setAttribute('aria-hidden', 'true');

      const commands = this.registry.getCommands(menu.id);
      for (const command of commands) {
        if (command.type === 'separator') {
          const separator = createElement('div', 'menubar__separator');
          dropdown.appendChild(separator);
          continue;
        }
        const commandButton = createElement('button', 'menubar__command');
        commandButton.type = 'button';
        commandButton.dataset.commandId = command.id;
        commandButton.disabled = !command.enabled;
        commandButton.setAttribute('role', 'menuitem');
        commandButton.addEventListener('click', event => this._handleCommandClick(command.id, event));

        if (command.checked) {
          commandButton.classList.add('is-checked');
        }

        const label = createElement('span', 'menubar__command-label');
        const indicator = createElement('span', 'menubar__command-indicator');
        indicator.setAttribute('aria-hidden', 'true');
        indicator.textContent = command.checked ? '✓' : '';
        label.append(indicator, document.createTextNode(command.title));

        const shortcut = createElement('span', 'menubar__command-shortcut');
        shortcut.textContent = command.shortcuts.length ? formatShortcut(command.shortcuts[0]) : '';

        commandButton.append(label, shortcut);
        dropdown.appendChild(commandButton);
      }

      container.append(button, dropdown);
      this.element.appendChild(container);
      this._menuNodes.set(menu.id, container);
    }

    if (currentOpen) {
      this._openSpecificMenu(currentOpen, { focusButton: false });
    }
  }

  _toggleMenu(menuId, event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (this._openMenuId === menuId) {
      this.close();
      return;
    }
    this._openSpecificMenu(menuId, { focusButton: true });
  }

  _openSpecificMenu(menuId, { focusButton } = {}) {
    if (this._openMenuId && this._openMenuId !== menuId) {
      this.close();
    }
    const menu = this._menuNodes.get(menuId);
    if (!menu) {
      this._openMenuId = null;
      return;
    }
    menu.classList.add(OPEN_CLASS);
    const dropdown = menu.querySelector('.menubar__dropdown');
    if (dropdown) {
      dropdown.setAttribute('aria-hidden', 'false');
    }
    const button = menu.querySelector('[data-menu-button="true"]');
    if (focusButton && button) {
      button.focus();
    }
    this._openMenuId = menuId;
  }

  _handleCommandClick(commandId, event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.registry.execute(commandId, { source: 'menubar', event });
    this.close();
  }

  _onDocumentClick(event) {
    if (!event) return;
    const target = event.target;
    if (this.element.contains(target)) {
      if (isMenuButton(target)) return;
      if (isCommandButton(target)) return;
    }
    this.close();
  }

  _onKeyDown(event) {
    if (event.key === 'Escape' && this._openMenuId) {
      const openMenuId = this._openMenuId;
      this.close();
      const menu = this._menuNodes.get(openMenuId);
      const button = menu?.querySelector('[data-menu-button="true"]');
      if (button) button.focus();
      event.stopPropagation();
      event.preventDefault();
    }
  }
}

export default Menubar;
