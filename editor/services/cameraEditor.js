import Camera from '../../engine/render/camera/camera.js';
import { GetService } from '../../engine/core/index.js';
import { RunService } from '../../engine/services/RunService.js';
import {
  getActiveCamera,
  getGridEnabled,
  getGridFade,
  onActiveCameraChanged,
  setActiveCamera,
  setGridEnabled,
  setGridFade,
} from '../../engine/render/camera/manager.js';

const MIN_DISTANCE = 0.25;
const MAX_DISTANCE = 500;
const GRID_FADE_SPEED = 5;
const DEFAULT_FOCUS_DURATION = 0.35;

const settings = {
  mouseSensitivity: 0.0025,
  invertY: false,
  flySpeed: 12,
  fastMultiplier: 4,
};

let editorCamera = null;
let pivot = new Float32Array([0, 1, 0]);
let distance = 10;
let yaw = 0;
let pitch = 0;
let isAltDown = false;
let orbiting = false;
let panning = false;
let flying = false;
let active = false;
let previousMouseBehavior = 'Default';
let canvasRef = null;
let UIS = null;
let connections = [];
let wheelHandler = null;
let contextHandler = null;
let activeCameraDisposer = null;
let updateBound = null;
let focusAnimation = null;

function lengthVec(a, b) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.hypot(dx, dy, dz);
}

function normalize(vec) {
  const len = Math.hypot(vec[0], vec[1], vec[2]);
  if (!len) {
    return [0, 0, 0];
  }
  const inv = 1 / len;
  return [vec[0] * inv, vec[1] * inv, vec[2] * inv];
}

function setPivot(x, y, z) {
  pivot[0] = x;
  pivot[1] = y;
  pivot[2] = z;
}

function syncDistanceFromCamera() {
  if (!editorCamera) {
    return;
  }
  const pos = editorCamera.getPosition();
  distance = Math.max(MIN_DISTANCE, lengthVec(pos, pivot));
}

function syncOrientationFromCamera() {
  if (!editorCamera) {
    return;
  }
  yaw = editorCamera.getYaw();
  pitch = editorCamera.getPitch();
}

function applyOrbitTransform() {
  const clampedDistance = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, distance));
  distance = clampedDistance;
  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);

  const forward = [
    sinYaw * cosPitch,
    sinPitch,
    -cosYaw * cosPitch,
  ];
  const normForward = normalize(forward);
  const newPosition = [
    pivot[0] - normForward[0] * distance,
    pivot[1] - normForward[1] * distance,
    pivot[2] - normForward[2] * distance,
  ];
  editorCamera.setPosition(newPosition);
  editorCamera.setYawPitch(yaw, pitch);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function startFocusAnimation(targetPivot, targetDistance, duration = DEFAULT_FOCUS_DURATION) {
  if (!editorCamera) {
    return;
  }
  const safeDuration = Math.max(0.01, Number.isFinite(duration) ? duration : DEFAULT_FOCUS_DURATION);
  const pivotTarget = Array.isArray(targetPivot) ? targetPivot : [pivot[0], pivot[1], pivot[2]];
  const clampedDistance = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, targetDistance));

  if (safeDuration <= 0.015) {
    setPivot(pivotTarget[0], pivotTarget[1], pivotTarget[2]);
    distance = clampedDistance;
    applyOrbitTransform();
    focusAnimation = null;
    return;
  }

  focusAnimation = {
    elapsed: 0,
    duration: safeDuration,
    startPivot: [pivot[0], pivot[1], pivot[2]],
    endPivot: [pivotTarget[0], pivotTarget[1], pivotTarget[2]],
    startDistance: distance,
    endDistance: clampedDistance,
    startYaw: yaw,
    endYaw: yaw,
    startPitch: pitch,
    endPitch: pitch,
  };
}

function updateFocusAnimation(dt) {
  if (!focusAnimation) {
    return;
  }
  focusAnimation.elapsed += dt;
  const progress = Math.min(1, focusAnimation.elapsed / focusAnimation.duration);
  const eased = progress * progress * (3 - 2 * progress);
  const px = lerp(focusAnimation.startPivot[0], focusAnimation.endPivot[0], eased);
  const py = lerp(focusAnimation.startPivot[1], focusAnimation.endPivot[1], eased);
  const pz = lerp(focusAnimation.startPivot[2], focusAnimation.endPivot[2], eased);
  const dist = lerp(focusAnimation.startDistance, focusAnimation.endDistance, eased);
  const nextYaw = lerp(focusAnimation.startYaw, focusAnimation.endYaw, eased);
  const nextPitch = lerp(focusAnimation.startPitch, focusAnimation.endPitch, eased);

  setPivot(px, py, pz);
  yaw = nextYaw;
  pitch = nextPitch;
  distance = dist;
  applyOrbitTransform();

  if (progress >= 1) {
    focusAnimation = null;
  }
}

function updatePivotFromCamera() {
  if (!editorCamera) {
    return;
  }
  const pos = editorCamera.getPosition();
  const forward = editorCamera.getForward();
  setPivot(
    pos[0] + forward[0] * distance,
    pos[1] + forward[1] * distance,
    pos[2] + forward[2] * distance,
  );
}

function handleOrbit(deltaX, deltaY) {
  const invertFactor = settings.invertY ? -1 : 1;
  yaw += deltaX * settings.mouseSensitivity;
  pitch -= deltaY * settings.mouseSensitivity * invertFactor;
  applyOrbitTransform();
}

function handlePan(deltaX, deltaY) {
  const pos = editorCamera.getPosition();
  const right = editorCamera.getRight();
  const upVec = editorCamera.getUp();
  const scale = Math.max(distance, 1) * 0.0025;
  const moveX = deltaX * scale;
  const moveY = -deltaY * scale;
  const offset = [
    right[0] * moveX + upVec[0] * moveY,
    right[1] * moveX + upVec[1] * moveY,
    right[2] * moveX + upVec[2] * moveY,
  ];
  editorCamera.setPosition([
    pos[0] + offset[0],
    pos[1] + offset[1],
    pos[2] + offset[2],
  ]);
  setPivot(
    pivot[0] + offset[0],
    pivot[1] + offset[1],
    pivot[2] + offset[2],
  );
  syncDistanceFromCamera();
}

function handleFlyLook(deltaX, deltaY) {
  const invertFactor = settings.invertY ? -1 : 1;
  yaw += deltaX * settings.mouseSensitivity;
  pitch -= deltaY * settings.mouseSensitivity * invertFactor;
  editorCamera.setYawPitch(yaw, pitch);
  updatePivotFromCamera();
}

function handleFlyMovement(dt) {
  if (!UIS) {
    return;
  }
  const forward = editorCamera.getForward();
  const right = editorCamera.getRight();
  const up = [0, 1, 0];
  const move = [0, 0, 0];

  if (UIS.IsKeyDown('W')) {
    move[0] += forward[0];
    move[1] += forward[1];
    move[2] += forward[2];
  }
  if (UIS.IsKeyDown('S')) {
    move[0] -= forward[0];
    move[1] -= forward[1];
    move[2] -= forward[2];
  }
  if (UIS.IsKeyDown('D')) {
    move[0] += right[0];
    move[1] += right[1];
    move[2] += right[2];
  }
  if (UIS.IsKeyDown('A')) {
    move[0] -= right[0];
    move[1] -= right[1];
    move[2] -= right[2];
  }
  if (UIS.IsKeyDown('Space')) {
    move[0] += up[0];
    move[1] += up[1];
    move[2] += up[2];
  }
  if (UIS.IsKeyDown('Ctrl')) {
    move[0] -= up[0];
    move[1] -= up[1];
    move[2] -= up[2];
  }

  const len = Math.hypot(move[0], move[1], move[2]);
  if (len > 0) {
    let speed = settings.flySpeed;
    if (UIS.IsKeyDown('Shift')) {
      speed *= settings.fastMultiplier;
    }
    const inv = 1 / len;
    const direction = [move[0] * inv, move[1] * inv, move[2] * inv];
    const delta = speed * dt;
    editorCamera.translate([
      direction[0] * delta,
      direction[1] * delta,
      direction[2] * delta,
    ]);
    updatePivotFromCamera();
    syncDistanceFromCamera();
  }
}

function updateGridFade(dt) {
  const target = getGridEnabled() ? 1 : 0;
  const current = getGridFade();
  if (Math.abs(target - current) < 0.001) {
    setGridFade(target);
    return;
  }
  const step = Math.min(1, dt * GRID_FADE_SPEED);
  const next = current + (target - current) * step;
  setGridFade(next);
}

function update(dt) {
  updateGridFade(dt);
  updateFocusAnimation(dt);
  if (!active || !editorCamera) {
    return;
  }
  if (flying) {
    handleFlyMovement(dt);
  }
}

function stopInteractions() {
  orbiting = false;
  panning = false;
  if (flying) {
    flying = false;
    if (UIS) {
      UIS.MouseBehavior = previousMouseBehavior;
    }
  }
}

function handleInputBegan(input) {
  if (!active) {
    return;
  }
  if (input.UserInputType === 'Keyboard') {
    if (input.KeyCode === 'AltLeft' || input.KeyCode === 'AltRight') {
      isAltDown = true;
    } else if (input.KeyCode === 'KeyG') {
      toggleGrid();
    }
    return;
  }

  if (input.UserInputType === 'MouseButton1' && isAltDown) {
    orbiting = true;
  } else if (input.UserInputType === 'MouseButton3') {
    panning = true;
  } else if (input.UserInputType === 'MouseButton2') {
    flying = true;
    if (UIS) {
      previousMouseBehavior = UIS.MouseBehavior;
      UIS.MouseBehavior = 'LockCenter';
    }
    if (canvasRef) {
      canvasRef.focus();
    }
  }
}

function handleInputEnded(input) {
  if (input.UserInputType === 'Keyboard') {
    if (input.KeyCode === 'AltLeft' || input.KeyCode === 'AltRight') {
      isAltDown = false;
      orbiting = false;
    }
    return;
  }

  if (input.UserInputType === 'MouseButton1') {
    orbiting = false;
  } else if (input.UserInputType === 'MouseButton3') {
    panning = false;
  } else if (input.UserInputType === 'MouseButton2') {
    if (flying && UIS) {
      UIS.MouseBehavior = previousMouseBehavior;
    }
    flying = false;
  }
}

function handleInputChanged(input) {
  if (!active) {
    return;
  }
  if (input.UserInputType === 'MouseMovement') {
    const dx = input.Delta?.x ?? 0;
    const dy = input.Delta?.y ?? 0;
    if (orbiting) {
      handleOrbit(dx, dy);
    } else if (panning) {
      handlePan(dx, dy);
    } else if (flying) {
      handleFlyLook(dx, dy);
    }
  }
}

function handleWheel(event) {
  if (!active || !editorCamera) {
    return;
  }
  event.preventDefault();
  const delta = event.deltaY;
  if (!Number.isFinite(delta) || delta === 0) {
    return;
  }
  const factor = Math.exp(delta * 0.0015);
  distance = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, distance * factor));
  applyOrbitTransform();
  syncDistanceFromCamera();
}

function handleContextMenu(event) {
  event.preventDefault();
}

export function initEditorCamera(canvas) {
  if (editorCamera) {
    return editorCamera;
  }
  canvasRef = canvas;
  UIS = GetService('UserInputService');
  editorCamera = new Camera({
    position: [0, 6, 16],
    target: [0, 2, 0],
    near: 0.1,
    far: 500,
    fov: Math.PI / 3,
  });
  setActiveCamera(editorCamera);
  active = true;
  setGridEnabled(true);
  setGridFade(1);
  setPivot(0, 2, 0);
  syncDistanceFromCamera();
  syncOrientationFromCamera();

  connections = [
    UIS?.InputBegan.Connect(handleInputBegan),
    UIS?.InputEnded.Connect(handleInputEnded),
    UIS?.InputChanged.Connect(handleInputChanged),
  ].filter(Boolean);

  wheelHandler = handleWheel;
  contextHandler = handleContextMenu;
  canvas.addEventListener('wheel', wheelHandler, { passive: false });
  canvas.addEventListener('contextmenu', contextHandler);

  updateBound = dt => update(dt);
  RunService.BindToRenderStep('EditorCamera::Update', 150, updateBound);

  activeCameraDisposer = onActiveCameraChanged(camera => {
    const isEditor = camera === editorCamera;
    if (!isEditor) {
      stopInteractions();
    } else {
      syncOrientationFromCamera();
      syncDistanceFromCamera();
    }
    active = isEditor;
  });

  return editorCamera;
}

export function getEditorCamera() {
  return editorCamera;
}

export function getCameraSettings() {
  return { ...settings };
}

export function updateCameraSettings(partial) {
  if (!partial || typeof partial !== 'object') {
    return;
  }
  if (typeof partial.mouseSensitivity === 'number' && partial.mouseSensitivity > 0) {
    settings.mouseSensitivity = partial.mouseSensitivity;
  }
  if (typeof partial.invertY === 'boolean') {
    settings.invertY = partial.invertY;
  }
  if (typeof partial.flySpeed === 'number' && partial.flySpeed > 0) {
    settings.flySpeed = partial.flySpeed;
  }
  if (typeof partial.fastMultiplier === 'number' && partial.fastMultiplier > 0) {
    settings.fastMultiplier = partial.fastMultiplier;
  }
}

export function toggleGrid() {
  setGridEnabled(!getGridEnabled());
}

export function setGridVisible(visible) {
  setGridEnabled(Boolean(visible));
}

export function isGridVisible() {
  return getGridEnabled();
}

export function restoreEditorCamera() {
  const current = getActiveCamera();
  if (editorCamera && current !== editorCamera) {
    setActiveCamera(editorCamera);
  }
}

export function disposeEditorCamera() {
  if (activeCameraDisposer) {
    activeCameraDisposer();
    activeCameraDisposer = null;
  }
  if (updateBound) {
    RunService.UnbindFromRenderStep('EditorCamera::Update');
    updateBound = null;
  }
  for (const connection of connections) {
    connection?.Disconnect?.();
  }
  connections = [];
  if (canvasRef && wheelHandler) {
    canvasRef.removeEventListener('wheel', wheelHandler);
  }
  if (canvasRef && contextHandler) {
    canvasRef.removeEventListener('contextmenu', contextHandler);
  }
  if (UIS) {
    UIS.MouseBehavior = 'Default';
  }
  editorCamera = null;
  UIS = null;
  canvasRef = null;
}

export function focusCameraOnBounds(bounds, { duration = DEFAULT_FOCUS_DURATION } = {}) {
  if (!bounds || !editorCamera) {
    return;
  }

  const center = bounds.center ?? { x: 0, y: 0, z: 0 };
  const size = bounds.size ?? { x: 0, y: 0, z: 0 };

  const cx = typeof center.x === 'number' ? center.x : 0;
  const cy = typeof center.y === 'number' ? center.y : 0;
  const cz = typeof center.z === 'number' ? center.z : 0;

  const extentX = Math.max(0.001, typeof size.x === 'number' ? size.x : 0);
  const extentY = Math.max(0.001, typeof size.y === 'number' ? size.y : 0);
  const extentZ = Math.max(0.001, typeof size.z === 'number' ? size.z : 0);

  const radius = Math.max(extentX, extentY, extentZ) * 0.5 || 0.5;

  const fov = editorCamera.getFov?.() ?? Math.PI / 3;
  const aspect = editorCamera.getAspect?.() ?? 1;
  const halfVertical = Math.max(0.087, fov * 0.5);
  const halfHorizontal = Math.max(0.087, Math.min(Math.PI * 0.49, Math.atan(Math.tan(halfVertical) * aspect)));
  const verticalDistance = radius / Math.sin(halfVertical);
  const horizontalDistance = radius / Math.sin(halfHorizontal);
  let targetDistance = Math.max(verticalDistance, horizontalDistance);

  if (!Number.isFinite(targetDistance) || targetDistance <= 0) {
    targetDistance = radius * 3;
  }

  const paddedDistance = Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE * 2, targetDistance * 1.15));

  startFocusAnimation([cx, cy, cz], paddedDistance, duration);
}
