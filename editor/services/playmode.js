import { GetService } from "../../engine/core/index.js";
import Camera from "../../engine/render/camera/camera.js";
import { FirstPersonController } from "../../engine/render/camera/controllers.js";
import { getActiveCamera, getGridEnabled, setActiveCamera, setGridEnabled } from "../../engine/render/camera/manager.js";
import { getCameraSettings, restoreEditorCamera } from "./cameraEditor.js";

const DEFAULT_ENTRY = "/game/main.client.js";

let playing = false;
let currentModule = null;
let runtimeCamera = null;
let runtimeController = null;
let savedCamera = null;
let savedGridVisible = true;
let savedLightingState = null;

function setupRuntimeCamera() {
  const UIS = GetService("UserInputService");
  const settings = getCameraSettings();
  savedCamera = getActiveCamera();
  savedGridVisible = getGridEnabled();

  runtimeCamera = savedCamera ? savedCamera.clone() : new Camera({
    position: [0, 2, 6],
    target: [0, 1, 0],
    near: 0.1,
    far: 500,
    fov: Math.PI / 3,
  });
  setActiveCamera(runtimeCamera);
  setGridEnabled(false);

  runtimeController = new FirstPersonController(runtimeCamera, UIS, {
    moveSpeed: settings.flySpeed,
    fastMultiplier: settings.fastMultiplier,
    lookSensitivity: settings.mouseSensitivity,
    invertY: settings.invertY,
  });
  runtimeController.setEnabled(true);
}

function teardownRuntimeCamera() {
  if (runtimeController) {
    runtimeController.dispose();
    runtimeController = null;
  }
  runtimeCamera = null;
  setGridEnabled(savedGridVisible);
  if (savedCamera) {
    setActiveCamera(savedCamera);
  } else {
    restoreEditorCamera();
  }
  savedCamera = null;
}

async function loadClientModule(entryUrl = DEFAULT_ENTRY) {
  const url = `${entryUrl}?t=${Date.now()}`; // cache-bust on each Play
  try {
    const mod = await import(url);
    return mod;
  } catch (err) {
    console.error("[PLAY] Failed to import client module:", entryUrl, err);
    throw err;
  }
}

export async function startPlay(entryUrl = DEFAULT_ENTRY) {
  if (playing) return;
  console.log(" [PLAY] Starting…");
  playing = true;

  // TODO: clone editor scene graph into an isolated play graph here.

  try {
    setupRuntimeCamera();
    const lighting = GetService("Lighting");
    if (lighting?.setTimeAnimating) {
      const currentSpeed = lighting.getTimeSpeed?.();
      const safeSpeed = Number.isFinite(currentSpeed) ? currentSpeed : 0.05;
      savedLightingState = {
        animating: lighting.isTimeAnimating?.() ?? false,
        speed: safeSpeed,
      };
      lighting.setTimeAnimating(true);
      if (!Number.isFinite(currentSpeed) || currentSpeed === 0) {
        lighting.setTimeSpeed?.(safeSpeed);
      }
    }
    currentModule = await loadClientModule(entryUrl);
    if (typeof currentModule.start === "function") {
      await currentModule.start();
    }
    console.log(" [PLAY] Running.");
  } catch (err) {
    console.error("[PLAY] Failed to load", entryUrl, err);
    playing = false;
    const lighting = GetService("Lighting");
    if (lighting?.setTimeAnimating && savedLightingState) {
      lighting.setTimeAnimating(savedLightingState.animating);
      if (lighting?.setTimeSpeed) {
        lighting.setTimeSpeed(savedLightingState.speed);
      }
    }
    savedLightingState = null;
    teardownRuntimeCamera();
  }
}

export async function stopPlay() {
  if (!playing) return;
  console.log(" [PLAY] Stopping…");
  try {
    if (currentModule && typeof currentModule.stop === "function") {
      await currentModule.stop();
    }
  } catch (err) {
    console.warn("[PLAY] stop() error", err);
  }
  // TODO: teardown play graph, restore editor state.
  currentModule = null;
  playing = false;
  const lighting = GetService("Lighting");
  if (lighting?.setTimeAnimating && savedLightingState) {
    lighting.setTimeAnimating(savedLightingState.animating);
    if (lighting?.setTimeSpeed) {
      lighting.setTimeSpeed(savedLightingState.speed);
    }
  }
  savedLightingState = null;
  teardownRuntimeCamera();
  console.log(" [PLAY] Stopped.");
}
