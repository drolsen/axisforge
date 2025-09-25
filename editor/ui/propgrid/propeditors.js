import ColorPicker, { rgbToHex } from '../colorpicker.js';

const registry = new Map();
const MIXED_PLACEHOLDER = '—';

function noop() {}

function createWrapper(className) {
  const wrapper = document.createElement('div');
  wrapper.className = `property-editor ${className}`.trim();
  return wrapper;
}

function setMixedState(element, mixed) {
  element.classList.toggle('is-mixed', Boolean(mixed));
}

function formatNumber(value, { precision } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  if (typeof precision === 'number') {
    return value.toFixed(precision);
  }
  return value.toString();
}

function parseNumber(value, fallback = null) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return num;
}

function createTextEditor(config) {
  const { value = '', readOnly = false, placeholder = '', mixed = false, onCommit = noop, options = {} } = config;
  const wrapper = createWrapper('property-editor--text');
  const input = options.multiline ? document.createElement('textarea') : document.createElement('input');
  if (!options.multiline) {
    input.type = options.type ?? 'text';
  }
  input.className = 'property-editor__field';
  input.value = value ?? '';
  input.placeholder = placeholder ?? '';
  input.disabled = Boolean(readOnly);
  if (options.maxLength) input.maxLength = options.maxLength;
  if (options.minLength) input.minLength = options.minLength;
  if (options.monospace) input.classList.add('is-monospace');
  if (options.inputMode) input.inputMode = options.inputMode;

  const commit = () => {
    if (readOnly) return;
    onCommit(input.value);
  };

  input.addEventListener('change', commit);
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', event => {
    if (!options.multiline && event.key === 'Enter') {
      event.preventDefault();
      input.blur();
    }
    if (options.multiline && event.key === 'Enter' && event.metaKey) {
      commit();
    }
  });

  wrapper.appendChild(input);
  setMixedState(wrapper, mixed);

  return {
    element: wrapper,
    setValue(newValue) {
      if (document.activeElement === input) return;
      input.value = newValue ?? '';
    },
    setMixed(flag) {
      setMixedState(wrapper, flag);
      if (flag) {
        input.placeholder = '—';
        if (!readOnly) input.value = '';
      } else {
        input.placeholder = placeholder ?? '';
      }
    },
    focus() {
      input.focus();
      if (!options.multiline) input.select();
    },
    dispose: noop,
  };
}

function createNumberEditor(config) {
  const { value = null, readOnly = false, placeholder = '', mixed = false, onCommit = noop, onInput = null, options = {} } = config;
  const wrapper = createWrapper('property-editor--number');
  const input = document.createElement('input');
  input.type = 'number';
  input.step = options.step ?? '0.01';
  if (options.min != null) input.min = options.min;
  if (options.max != null) input.max = options.max;
  input.className = 'property-editor__field';
  input.disabled = Boolean(readOnly);
  input.placeholder = placeholder ?? '';
  if (value != null) {
    input.value = formatNumber(value, options);
  }

  const emit = handler => {
    if (!handler) return;
    const num = parseNumber(input.value, null);
    if (num == null) return;
    handler(num);
  };

  input.addEventListener('change', () => emit(onCommit));
  input.addEventListener('input', () => emit(onInput));
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      input.blur();
    }
  });
  input.addEventListener('blur', () => emit(onCommit));

  wrapper.appendChild(input);
  setMixedState(wrapper, mixed);

  return {
    element: wrapper,
    setValue(newValue) {
      if (document.activeElement === input) return;
      if (newValue == null) {
        input.value = '';
      } else {
        input.value = formatNumber(newValue, options);
      }
    },
    setMixed(flag) {
      setMixedState(wrapper, flag);
      if (flag) {
        input.placeholder = '—';
        if (!readOnly) input.value = '';
      } else {
        input.placeholder = placeholder ?? '';
      }
    },
    focus() {
      input.focus();
      input.select();
    },
    dispose: noop,
  };
}

function createBoolEditor(config) {
  const { value = false, readOnly = false, onCommit = noop, onInput = null, mixed = false } = config;
  const wrapper = createWrapper('property-editor--bool');
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'property-editor__toggle';
  const label = document.createElement('span');
  label.className = 'property-editor__toggle-label';
  wrapper.append(toggle, label);

  let isMixed = Boolean(mixed);
  let currentValue = Boolean(value);

  const update = val => {
    currentValue = Boolean(val);
    toggle.classList.toggle('is-on', currentValue);
    label.textContent = currentValue ? 'On' : 'Off';
    isMixed = false;
  };
  update(Boolean(value));

  const emit = val => {
    if (readOnly) return;
    update(val);
    if (onInput) onInput(val);
    onCommit(val);
  };

  toggle.addEventListener('click', () => {
    const next = isMixed ? true : !toggle.classList.contains('is-on');
    isMixed = false;
    emit(next);
  });

  return {
    element: wrapper,
    setValue(val) {
      update(Boolean(val));
    },
    setMixed(flag) {
      setMixedState(wrapper, flag);
      isMixed = Boolean(flag);
      if (flag) {
        toggle.classList.remove('is-on');
        label.textContent = MIXED_PLACEHOLDER;
      } else {
        update(currentValue);
      }
    },
    focus() {
      toggle.focus();
    },
    dispose: noop,
  };
}

function createSelectEditor(config) {
  const { value = null, readOnly = false, placeholder = '', mixed = false, onCommit = noop, options = {} } = config;
  const wrapper = createWrapper('property-editor--select');
  const select = document.createElement('select');
  select.className = 'property-editor__select';
  select.disabled = Boolean(readOnly);

  if (placeholder) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = placeholder;
    select.appendChild(option);
  }

  const choices = Array.isArray(options.choices) ? options.choices : [];
  for (const choice of choices) {
    const option = document.createElement('option');
    option.value = choice.value;
    option.textContent = choice.label ?? String(choice.value ?? '');
    select.appendChild(option);
  }
  if (value != null) {
    select.value = value;
  } else if (placeholder) {
    select.value = '';
  }

  select.addEventListener('change', () => {
    onCommit(select.value);
  });

  wrapper.appendChild(select);
  setMixedState(wrapper, mixed);

  return {
    element: wrapper,
    setValue(newValue) {
      select.value = newValue ?? '';
    },
    setMixed(flag) {
      setMixedState(wrapper, flag);
      if (flag && placeholder) {
        select.value = '';
      }
    },
    focus() {
      select.focus();
    },
    dispose: noop,
  };
}

function createSliderEditor(config) {
  const { value = 0, readOnly = false, onCommit = noop, onInput = null, options = {} } = config;
  const wrapper = createWrapper('property-editor--slider');
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = options.min ?? 0;
  slider.max = options.max ?? 1;
  slider.step = options.step ?? 0.01;
  slider.value = value ?? slider.min;
  slider.disabled = Boolean(readOnly);
  slider.className = 'property-editor__slider';

  const readout = document.createElement('span');
  readout.className = 'property-editor__slider-value';
  readout.textContent = formatNumber(Number(slider.value), options);

  const emitInput = handler => {
    if (!handler) return;
    const num = parseNumber(slider.value, null);
    if (num == null) return;
    handler(num);
  };

  slider.addEventListener('input', () => {
    readout.textContent = formatNumber(Number(slider.value), options);
    emitInput(onInput);
  });
  slider.addEventListener('change', () => {
    readout.textContent = formatNumber(Number(slider.value), options);
    emitInput(onCommit);
  });

  wrapper.append(slider, readout);

  return {
    element: wrapper,
    setValue(newValue) {
      if (newValue == null) return;
      slider.value = newValue;
      readout.textContent = formatNumber(Number(slider.value), options);
    },
    setMixed(flag) {
      setMixedState(wrapper, flag);
    },
    focus() {
      slider.focus();
    },
    dispose: noop,
  };
}

function sanitizeColor(value) {
  if (!value || typeof value !== 'object') {
    return { r: 1, g: 1, b: 1 };
  }
  return {
    r: typeof value.r === 'number' ? Math.min(Math.max(value.r, 0), 1) : 0,
    g: typeof value.g === 'number' ? Math.min(Math.max(value.g, 0), 1) : 0,
    b: typeof value.b === 'number' ? Math.min(Math.max(value.b, 0), 1) : 0,
  };
}

function createColorEditor(config) {
  const { value = { r: 1, g: 1, b: 1 }, readOnly = false, mixed = false, onCommit = noop, onInput = null } = config;
  const wrapper = createWrapper('property-editor--color');
  const swatch = document.createElement('button');
  swatch.type = 'button';
  swatch.className = 'property-editor__color-swatch';
  swatch.disabled = Boolean(readOnly);
  const label = document.createElement('span');
  label.className = 'property-editor__color-label';
  wrapper.append(swatch, label);

  let current = sanitizeColor(value);
  let picker = null;
  let popover = null;

  const updateDisplay = color => {
    const hex = rgbToHex(color);
    swatch.style.backgroundColor = hex;
    label.textContent = hex;
  };

  const closePopover = commit => {
    if (!popover) return;
    popover.remove();
    popover = null;
    picker?.dispose();
    picker = null;
    window.removeEventListener('mousedown', handleWindowDown, true);
    window.removeEventListener('resize', positionPopover);
    window.removeEventListener('keydown', handleKey);
    if (commit) {
      onCommit(current);
    }
  };

  const handleChange = color => {
    current = sanitizeColor(color);
    updateDisplay(current);
    if (onInput) onInput(current);
  };

  const positionPopover = () => {
    if (!popover) return;
    const rect = swatch.getBoundingClientRect();
    popover.style.top = `${rect.bottom + window.scrollY + 6}px`;
    popover.style.left = `${rect.left + window.scrollX}px`;
  };

  const handleWindowDown = event => {
    if (!popover) return;
    if (popover.contains(event.target) || swatch.contains(event.target)) {
      return;
    }
    closePopover(true);
  };

  const handleKey = event => {
    if (event.key === 'Escape') {
      closePopover(false);
    }
  };

  const openPopover = () => {
    if (readOnly || popover) return;
    popover = document.createElement('div');
    popover.className = 'property-editor__popover';
    picker = new ColorPicker({ color: current, onChange: handleChange });
    popover.appendChild(picker.getElement());
    document.body.appendChild(popover);
    positionPopover();
    window.addEventListener('mousedown', handleWindowDown, true);
    window.addEventListener('resize', positionPopover);
    window.addEventListener('keydown', handleKey);
  };

  swatch.addEventListener('click', () => {
    if (popover) {
      closePopover(true);
    } else {
      openPopover();
    }
  });

  updateDisplay(current);
  setMixedState(wrapper, mixed);

  return {
    element: wrapper,
    setValue(color) {
      current = sanitizeColor(color);
      updateDisplay(current);
    },
    setMixed(flag) {
      setMixedState(wrapper, flag);
      if (flag) {
        label.textContent = '—';
        swatch.style.backgroundColor = 'transparent';
      } else {
        updateDisplay(current);
      }
    },
    focus() {
      swatch.focus();
    },
    dispose() {
      closePopover(false);
    },
  };
}

function createVectorEditor(config) {
  const { value = { x: 0, y: 0, z: 0 }, mixed = null, readOnly = false, onCommit = noop, onInput = null, options = {} } = config;
  const wrapper = createWrapper('property-editor--vector');
  const axes = ['x', 'y', 'z'];
  const inputs = new Map();

  const createField = axis => {
    const field = document.createElement('input');
    field.type = 'number';
    field.step = options.step ?? '0.01';
    if (options.min != null) field.min = options.min;
    if (options.max != null) field.max = options.max;
    field.placeholder = axis.toUpperCase();
    field.disabled = Boolean(readOnly);
    field.dataset.axis = axis;
    field.className = 'property-editor__vector-field';
    if (value && typeof value[axis] === 'number') {
      field.value = formatNumber(value[axis], options);
    }
    const emit = handler => {
      if (!handler) return;
      const num = parseNumber(field.value, null);
      if (num == null) return;
      handler({ axis, value: num });
    };
    field.addEventListener('change', () => emit(onCommit));
    field.addEventListener('input', () => emit(onInput));
    field.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        field.blur();
      }
    });
    field.addEventListener('blur', () => emit(onCommit));
    inputs.set(axis, field);
    return field;
  };

  for (const axis of axes) {
    const field = createField(axis);
    wrapper.appendChild(field);
  }

  const updateMixed = state => {
    if (!state) {
      for (const [axis, input] of inputs.entries()) {
        input.classList.remove('is-mixed');
        input.placeholder = axis.toUpperCase();
      }
      return;
    }
    for (const [axis, input] of inputs.entries()) {
      const flag = Boolean(state[axis]);
      input.classList.toggle('is-mixed', flag);
      input.placeholder = flag ? '—' : axis.toUpperCase();
      if (flag && !readOnly) {
        input.value = '';
      }
    }
  };

  updateMixed(mixed);

  return {
    element: wrapper,
    setValue(newValue) {
      if (!newValue || typeof newValue !== 'object') return;
      for (const [axis, input] of inputs.entries()) {
        if (document.activeElement === input) continue;
        const val = newValue[axis];
        input.value = typeof val === 'number' ? formatNumber(val, options) : '';
      }
    },
    setMixed(state) {
      updateMixed(state);
    },
    focus() {
      inputs.get('x')?.focus();
      inputs.get('x')?.select();
    },
    dispose: noop,
  };
}

function createDropdownEditor(config) {
  return createSelectEditor(config);
}

function createCustomEditor(config) {
  const wrapper = createWrapper('property-editor--custom');
  const render = config?.options?.render;
  let controls = null;
  if (typeof render === 'function') {
    controls = render(wrapper, config) || null;
  }
  const api = controls || {};
  return {
    element: wrapper,
    setValue: api.setValue || noop,
    setMixed: api.setMixed || noop,
    focus: api.focus || noop,
    dispose: api.dispose || noop,
  };
}

function registerDefaults() {
  if (registry.size > 0) return;
  registerEditor('text', createTextEditor);
  registerEditor('number', createNumberEditor);
  registerEditor('bool', createBoolEditor);
  registerEditor('enum', createSelectEditor);
  registerEditor('dropdown', createDropdownEditor);
  registerEditor('slider', createSliderEditor);
  registerEditor('vector3', createVectorEditor);
  registerEditor('color3', createColorEditor);
  registerEditor('custom', createCustomEditor);
}

function registerEditor(type, factory) {
  if (!type || typeof factory !== 'function') return;
  registry.set(type, factory);
}

function createEditor(type, config = {}) {
  registerDefaults();
  const factory = registry.get(type);
  if (!factory) {
    throw new Error(`No property editor registered for type "${type}"`);
  }
  return factory(config);
}

export { registerEditor, createEditor };
