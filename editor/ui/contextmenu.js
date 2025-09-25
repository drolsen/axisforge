const ACTIVE_MENUS = new Set();
let rootMenu = null;
let outsideHandler = null;
let keydownHandler = null;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

class ContextMenu {
  constructor(items, parent = null) {
    this.parent = parent;
    this.items = Array.isArray(items) ? items : [];
    this.element = document.createElement('div');
    this.element.className = 'contextmenu';
    if (parent) {
      this.element.classList.add('contextmenu--submenu');
    }
    this.submenus = new Set();
    this._build();
  }

  _build() {
    for (const item of this.items) {
      if (!item) continue;
      if (item.type === 'separator') {
        const separator = document.createElement('div');
        separator.className = 'contextmenu__separator';
        this.element.appendChild(separator);
        continue;
      }

      const wrapper = document.createElement('div');
      wrapper.className = 'contextmenu__item';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'contextmenu__button';
      button.textContent = item.label ?? '';
      if (item.shortcut) {
        const shortcut = document.createElement('span');
        shortcut.className = 'contextmenu__shortcut';
        shortcut.textContent = item.shortcut;
        button.appendChild(shortcut);
      }
      if (item.disabled) {
        wrapper.classList.add('is-disabled');
        button.disabled = true;
      }
      wrapper.appendChild(button);

      if (Array.isArray(item.children) && item.children.length > 0) {
        wrapper.classList.add('contextmenu__item--submenu');
        const arrow = document.createElement('span');
        arrow.className = 'contextmenu__arrow';
        button.appendChild(arrow);
        const submenu = new ContextMenu(item.children, this);
        this.submenus.add(submenu);
        wrapper.addEventListener('pointerenter', () => {
          this._closeSubmenusExcept(submenu);
          submenu.openSubmenu(wrapper);
        });
        wrapper.addEventListener('pointerdown', event => {
          event.preventDefault();
        });
      } else if (!item.disabled) {
        button.addEventListener('click', () => {
          closeAllMenus();
          if (typeof item.action === 'function') {
            item.action();
          }
        });
      }

      this.element.appendChild(wrapper);
    }
  }

  _closeSubmenusExcept(exception) {
    for (const submenu of this.submenus) {
      if (submenu !== exception) submenu.close();
    }
  }

  openAt(x, y) {
    if (!document.body.contains(this.element)) {
      document.body.appendChild(this.element);
    }
    this.element.style.minWidth = '160px';
    this.element.style.opacity = '0';
    this.element.style.pointerEvents = 'none';
    this.element.style.left = '0px';
    this.element.style.top = '0px';
    this.element.style.visibility = 'hidden';
    requestAnimationFrame(() => {
      const rect = this.element.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const targetX = clamp(x, 8, viewportWidth - rect.width - 8);
      const targetY = clamp(y, 8, viewportHeight - rect.height - 8);
      this.element.style.left = `${targetX}px`;
      this.element.style.top = `${targetY}px`;
      this.element.style.visibility = 'visible';
      this.element.style.opacity = '1';
      this.element.style.pointerEvents = 'auto';
      ACTIVE_MENUS.add(this);
    });
  }

  openSubmenu(anchor) {
    if (!document.body.contains(this.element)) {
      document.body.appendChild(this.element);
    }
    const anchorRect = anchor.getBoundingClientRect();
    const rect = this.element.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    let x = anchorRect.right + 4;
    if (x + rect.width > viewportWidth) {
      x = Math.max(8, anchorRect.left - rect.width - 4);
    }
    let y = anchorRect.top;
    if (y + rect.height > viewportHeight) {
      y = viewportHeight - rect.height - 8;
    }
    this.element.style.left = `${x}px`;
    this.element.style.top = `${y}px`;
    this.element.style.visibility = 'visible';
    this.element.style.opacity = '1';
    this.element.style.pointerEvents = 'auto';
    ACTIVE_MENUS.add(this);
  }

  close() {
    this._closeSubmenusExcept(null);
    if (this.element && this.element.parentElement) {
      this.element.parentElement.removeChild(this.element);
    }
    ACTIVE_MENUS.delete(this);
  }
}

function closeAllMenus() {
  for (const menu of Array.from(ACTIVE_MENUS)) {
    menu.close();
  }
  ACTIVE_MENUS.clear();
  if (outsideHandler) {
    document.removeEventListener('pointerdown', outsideHandler, true);
    outsideHandler = null;
  }
  if (keydownHandler) {
    document.removeEventListener('keydown', keydownHandler, true);
    keydownHandler = null;
  }
  rootMenu = null;
}

function ensureGlobalHandlers() {
  if (!outsideHandler) {
    outsideHandler = event => {
      if (!rootMenu) return;
      const target = event.target;
      for (const menu of ACTIVE_MENUS) {
        if (menu.element.contains(target)) {
          return;
        }
      }
      closeAllMenus();
    };
    document.addEventListener('pointerdown', outsideHandler, true);
  }
  if (!keydownHandler) {
    keydownHandler = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeAllMenus();
      }
    };
    document.addEventListener('keydown', keydownHandler, true);
  }
}

export function showContextMenu(position, items) {
  const { x, y } = position instanceof Event
    ? (() => {
      position.preventDefault();
      return { x: position.clientX, y: position.clientY };
    })()
    : position;
  closeAllMenus();
  rootMenu = new ContextMenu(items, null);
  ensureGlobalHandlers();
  rootMenu.openAt(x, y);
  return rootMenu;
}

export function closeContextMenu() {
  closeAllMenus();
}

export default showContextMenu;
