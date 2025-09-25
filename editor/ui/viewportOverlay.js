import { formatShortcut } from './hotkeys.js';

function createLabel(text) {
  const label = document.createElement('span');
  label.className = 'viewport-overlay__label';
  label.textContent = text;
  return label;
}

function createButton(text, { hotkey = '', onClick = null, className = '' } = {}) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = ['viewport-overlay__button', className].filter(Boolean).join(' ');
  button.textContent = text;
  if (hotkey) {
    button.dataset.hotkey = formatShortcut(hotkey);
  }
  if (typeof onClick === 'function') {
    button.addEventListener('click', event => {
      event.preventDefault();
      onClick(event);
    });
  }
  return button;
}

function createDivider() {
  const divider = document.createElement('div');
  divider.className = 'viewport-overlay__divider';
  return divider;
}

function createSnapGroup(title, type, options, gizmos) {
  const group = document.createElement('div');
  group.className = 'viewport-overlay__group';
  group.appendChild(createLabel(title));

  const map = new Map();
  for (const option of options) {
    const value = option.value;
    const button = createButton(option.label, {
      onClick: () => gizmos?.toggleSnapValue?.(type, value),
    });
    map.set(value, button);
    group.appendChild(button);
  }

  return { element: group, buttons: map };
}

export function createViewportOverlay({ mount, gizmos, onFocus } = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'viewport-overlay';

  const topBar = document.createElement('div');
  topBar.className = 'viewport-overlay__top-bar';
  overlay.appendChild(topBar);

  const tint = document.createElement('div');
  tint.className = 'viewport-overlay__selection-tint';
  overlay.appendChild(tint);

  const toolGroup = document.createElement('div');
  toolGroup.className = 'viewport-overlay__group';
  toolGroup.appendChild(createLabel('Tool'));

  const tools = {
    select: createButton('Select', {
      hotkey: 'Q',
      onClick: () => gizmos?.setToolMode?.('select'),
    }),
    move: createButton('Move', {
      hotkey: 'W',
      onClick: () => gizmos?.setToolMode?.('move'),
    }),
    rotate: createButton('Rotate', {
      hotkey: 'E',
      onClick: () => gizmos?.setToolMode?.('rotate'),
    }),
    scale: createButton('Scale', {
      hotkey: 'R',
      onClick: () => gizmos?.setToolMode?.('scale'),
    }),
  };

  Object.values(tools).forEach(button => {
    toolGroup.appendChild(button);
  });

  topBar.appendChild(toolGroup);
  topBar.appendChild(createDivider());

  const translateSnap = createSnapGroup('Move Snap', 'translate', [
    { value: 1, label: '1 m' },
    { value: 0.5, label: '0.5 m' },
    { value: 0.1, label: '0.1 m' },
  ], gizmos);
  topBar.appendChild(translateSnap.element);

  const rotateSnap = createSnapGroup('Rotate', 'rotate', [
    { value: 45, label: '45°' },
    { value: 15, label: '15°' },
    { value: 5, label: '5°' },
  ], gizmos);
  topBar.appendChild(rotateSnap.element);

  const scaleSnap = createSnapGroup('Scale', 'scale', [
    { value: 0.1, label: '0.1' },
    { value: 0.01, label: '0.01' },
  ], gizmos);
  topBar.appendChild(scaleSnap.element);

  topBar.appendChild(createDivider());

  const spaceGroup = document.createElement('div');
  spaceGroup.className = 'viewport-overlay__group';
  spaceGroup.appendChild(createLabel('Space'));
  const globalButton = createButton('Global', {
    onClick: () => gizmos?.setTransformSpace?.('global'),
  });
  const localButton = createButton('Local', {
    onClick: () => gizmos?.setTransformSpace?.('local'),
  });
  spaceGroup.append(globalButton, localButton);
  topBar.appendChild(spaceGroup);

  const pivotGroup = document.createElement('div');
  pivotGroup.className = 'viewport-overlay__group';
  pivotGroup.appendChild(createLabel('Pivot'));
  const pivotButton = createButton('Pivot', {
    onClick: () => gizmos?.setPivotMode?.('pivot'),
  });
  const centerButton = createButton('Center', {
    onClick: () => gizmos?.setPivotMode?.('center'),
  });
  pivotGroup.append(pivotButton, centerButton);
  topBar.appendChild(pivotGroup);

  topBar.appendChild(createDivider());

  const focusButton = createButton('Focus', {
    className: 'viewport-overlay__focus-button',
    hotkey: 'F',
    onClick: () => onFocus?.(),
  });
  topBar.appendChild(focusButton);

  const updateState = state => {
    if (!state) return;
    const mode = state.mode ?? 'select';
    Object.entries(tools).forEach(([key, button]) => {
      const active = key === mode;
      button.classList.toggle('is-active', active);
    });

    const setSnapState = (map, value) => {
      for (const [snapValue, button] of map.entries()) {
        button.classList.toggle('is-active', snapValue === value);
      }
    };

    setSnapState(translateSnap.buttons, state.snap?.translate ?? null);
    setSnapState(rotateSnap.buttons, state.snap?.rotate ?? null);
    setSnapState(scaleSnap.buttons, state.snap?.scale ?? null);

    globalButton.classList.toggle('is-active', state.transformSpace === 'global');
    localButton.classList.toggle('is-active', state.transformSpace === 'local');

    pivotButton.classList.toggle('is-active', state.pivotMode === 'pivot');
    centerButton.classList.toggle('is-active', state.pivotMode === 'center');

    const hasSelection = Boolean(state.hasSelection);
    tint.classList.toggle('is-visible', hasSelection);
    focusButton.disabled = !hasSelection;
  };

  let unsubscribe = null;
  if (gizmos?.subscribe) {
    unsubscribe = gizmos.subscribe(updateState);
  }

  if (mount) {
    mount.appendChild(overlay);
  }

  return {
    element: overlay,
    update: updateState,
    dispose: () => {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
      overlay.remove();
    },
  };
}
