let activeCamera = null;
const listeners = new Set();

let gridEnabled = true;
let gridFade = 0;

export function setActiveCamera(camera) {
  if (activeCamera === camera) {
    return;
  }
  activeCamera = camera || null;
  for (const listener of listeners) {
    try {
      listener(activeCamera);
    } catch (err) {
      console.error('[CameraManager] listener error', err);
    }
  }
}

export function getActiveCamera() {
  return activeCamera;
}

export function onActiveCameraChanged(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setGridEnabled(enabled) {
  gridEnabled = Boolean(enabled);
}

export function getGridEnabled() {
  return gridEnabled;
}

export function setGridFade(value) {
  gridFade = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function getGridFade() {
  return gridFade;
}
