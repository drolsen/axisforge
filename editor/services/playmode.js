import { RunService } from "../../engine/services/RunService.js";
import { GetService } from "../../engine/core/index.js";

const DEFAULT_ENTRY = "/game/main.client.js";

let playing = false;
let currentModule = null;

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
    currentModule = await loadClientModule(entryUrl);
    if (typeof currentModule.start === "function") {
      await currentModule.start();
    }
    console.log(" [PLAY] Running.");
  } catch (err) {
    console.error("[PLAY] Failed to load", entryUrl, err);
    playing = false;
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
  console.log(" [PLAY] Stopped.");
}
