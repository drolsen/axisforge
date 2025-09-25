const DRAG_MIME = 'application/x-axisforge-asset';
const JSON_MIME = 'application/json';

function safeParse(json) {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function encodePayload(payload) {
  try {
    return JSON.stringify(payload);
  } catch (err) {
    console.warn('[DropDrag] Failed to encode payload', err);
    return null;
  }
}

function decodeTransfer(event) {
  const { dataTransfer } = event;
  if (!dataTransfer) return null;
  const raw = dataTransfer.getData(DRAG_MIME) || dataTransfer.getData(JSON_MIME) || dataTransfer.getData('text/plain');
  if (!raw) return null;
  if (raw.trim().startsWith('{')) {
    return safeParse(raw);
  }
  return { value: raw };
}

export function registerDragSource(element, getPayload, options = {}) {
  if (!element) {
    return () => {};
  }
  const resolve = () => {
    try {
      return typeof getPayload === 'function' ? getPayload() : getPayload;
    } catch (err) {
      console.warn('[DropDrag] Drag payload resolver failed', err);
      return null;
    }
  };
  const handleDragStart = event => {
    const payload = resolve();
    if (!payload) {
      event.preventDefault();
      return;
    }
    const encoded = encodePayload(payload);
    if (!encoded) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = options.effectAllowed || 'copy';
    event.dataTransfer.setData(DRAG_MIME, encoded);
    event.dataTransfer.setData(JSON_MIME, encoded);
    if (typeof payload.label === 'string') {
      event.dataTransfer.setData('text/plain', payload.label);
    }
    if (options.preview && event.dataTransfer.setDragImage) {
      const { element: previewEl, offsetX = 0, offsetY = 0 } = options.preview(payload) || {};
      if (previewEl instanceof Element) {
        event.dataTransfer.setDragImage(previewEl, offsetX, offsetY);
      }
    }
    if (typeof options.onStart === 'function') {
      options.onStart(payload, event);
    }
  };
  const handleDragEnd = event => {
    if (typeof options.onEnd === 'function') {
      options.onEnd(event);
    }
  };
  element.setAttribute('draggable', 'true');
  element.addEventListener('dragstart', handleDragStart);
  element.addEventListener('dragend', handleDragEnd);
  return () => {
    element.removeAttribute('draggable');
    element.removeEventListener('dragstart', handleDragStart);
    element.removeEventListener('dragend', handleDragEnd);
  };
}

export function registerDropTarget(element, { onDrop, onEnter, onLeave, types = null, effect = 'copy' } = {}) {
  if (!element) {
    return () => {};
  }
  let depth = 0;
  const accepts = payload => {
    if (!payload) return false;
    if (!types || !types.length) return true;
    const payloadType = payload.type || payload.kind;
    return types.includes(payloadType);
  };
  const handleDragOver = event => {
    const payload = decodeTransfer(event);
    if (!accepts(payload)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = effect;
  };
  const handleDrop = event => {
    const payload = decodeTransfer(event);
    depth = 0;
    element.classList.remove('is-drop-target');
    if (!accepts(payload)) {
      return;
    }
    event.preventDefault();
    if (typeof onDrop === 'function') {
      onDrop(payload, event);
    }
  };
  const handleEnter = event => {
    const payload = decodeTransfer(event);
    if (!accepts(payload)) {
      return;
    }
    depth += 1;
    element.classList.add('is-drop-target');
    if (typeof onEnter === 'function') {
      onEnter(payload, event);
    }
  };
  const handleLeave = event => {
    if (depth > 0) depth -= 1;
    if (depth === 0) {
      element.classList.remove('is-drop-target');
    }
    if (typeof onLeave === 'function') {
      onLeave(event);
    }
  };
  element.addEventListener('dragover', handleDragOver);
  element.addEventListener('drop', handleDrop);
  element.addEventListener('dragenter', handleEnter);
  element.addEventListener('dragleave', handleLeave);
  return () => {
    element.removeEventListener('dragover', handleDragOver);
    element.removeEventListener('drop', handleDrop);
    element.removeEventListener('dragenter', handleEnter);
    element.removeEventListener('dragleave', handleLeave);
    element.classList.remove('is-drop-target');
  };
}

export default { registerDragSource, registerDropTarget };
