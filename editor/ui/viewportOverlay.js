import { formatShortcut } from './hotkeys.js';

function createIcon(name) {
  const span = document.createElement('span');
  span.className = `icon icon--${name}`;
  return span;
}

function createButton({ icon = null, text = '', title = '', hotkey = '', onClick = null } = {}) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn';

  if (icon) {
    button.appendChild(createIcon(icon));
  }

  if (text) {
    const label = document.createElement('span');
    label.textContent = text;
    button.appendChild(label);
  }

  const parts = [];
  if (title) parts.push(title);
  if (hotkey) parts.push(`(${formatShortcut(hotkey)})`);
  if (parts.length) {
    button.title = parts.join(' ');
    button.setAttribute('aria-label', parts.join(' '));
  }

  if (typeof onClick === 'function') {
    button.addEventListener('click', event => {
      event.preventDefault();
      onClick(event);
    });
  }

  return button;
}

function createGroup(label) {
  const group = document.createElement('div');
  group.className = 'group';
  if (label) {
    const hidden = document.createElement('span');
    hidden.className = 'label';
    hidden.textContent = label;
    group.appendChild(hidden);
  }
  return group;
}

function createSnapGroup(label, type, options, gizmos) {
  const group = createGroup(label);
  const map = new Map();
  for (const option of options) {
    const value = option.value;
    const button = createButton({
      text: option.label,
      title: `${label} ${option.label}`,
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

  const bar = document.createElement('div');
  bar.className = 'vpbar';
  overlay.appendChild(bar);

  const tint = document.createElement('div');
  tint.className = 'viewport-overlay__selection-tint';
  overlay.appendChild(tint);

  const toolGroup = createGroup('Tool');
  const tools = {
    select: createButton({ icon: 'tool-select', title: 'Select Tool', hotkey: 'Q', onClick: () => gizmos?.setToolMode?.('select') }),
    move: createButton({ icon: 'tool-move', title: 'Move Tool', hotkey: 'W', onClick: () => gizmos?.setToolMode?.('move') }),
    rotate: createButton({ icon: 'tool-rotate', title: 'Rotate Tool', hotkey: 'E', onClick: () => gizmos?.setToolMode?.('rotate') }),
    scale: createButton({ icon: 'tool-scale', title: 'Scale Tool', hotkey: 'R', onClick: () => gizmos?.setToolMode?.('scale') }),
  };

  Object.values(tools).forEach(button => toolGroup.appendChild(button));
  bar.appendChild(toolGroup);

  const translateSnap = createSnapGroup('Move Snap', 'translate', [
    { value: 1, label: '1m' },
    { value: 0.5, label: '0.5' },
    { value: 0.1, label: '0.1' },
  ], gizmos);
  bar.appendChild(translateSnap.element);

  const rotateSnap = createSnapGroup('Rotate Snap', 'rotate', [
    { value: 45, label: '45°' },
    { value: 15, label: '15°' },
    { value: 5, label: '5°' },
  ], gizmos);
  bar.appendChild(rotateSnap.element);

  const scaleSnap = createSnapGroup('Scale Snap', 'scale', [
    { value: 0.1, label: '0.1' },
    { value: 0.01, label: '0.01' },
  ], gizmos);
  bar.appendChild(scaleSnap.element);

  const spaceGroup = createGroup('Transform Space');
  const globalButton = createButton({
    icon: 'space-global',
    title: 'Global Space',
    hotkey: 'T',
    onClick: () => gizmos?.setTransformSpace?.('global'),
  });
  const localButton = createButton({
    icon: 'space-local',
    title: 'Local Space',
    hotkey: 'T',
    onClick: () => gizmos?.setTransformSpace?.('local'),
  });
  spaceGroup.append(globalButton, localButton);
  bar.appendChild(spaceGroup);

  const pivotGroup = createGroup('Pivot Mode');
  const pivotButton = createButton({
    icon: 'pivot-pivot',
    title: 'Pivot Origin',
    hotkey: 'Y',
    onClick: () => gizmos?.setPivotMode?.('pivot'),
  });
  const centerButton = createButton({
    icon: 'pivot-center',
    title: 'Center Pivot',
    hotkey: 'Y',
    onClick: () => gizmos?.setPivotMode?.('center'),
  });
  pivotGroup.append(pivotButton, centerButton);
  bar.appendChild(pivotGroup);

  const focusButton = createButton({
    icon: 'focus-camera',
    title: 'Focus Selection',
    hotkey: 'F',
    onClick: () => onFocus?.(),
  });
  bar.appendChild(focusButton);

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
