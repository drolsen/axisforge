// Example client entry. Runs in Play mode only (loaded via ESM).
import { GetService } from "/engine/core/index.js";

// If you prefer, you can also import the RunService singleton directly:
// import { RunService } from "/engine/services/RunService.js";
const RunService = GetService("RunService");

console.log("[Client] main.client.js loaded");

let t = 0;

export function start() {
  const Lighting = GetService("Lighting");
  // Example per-frame update; replace with your own gameplay code.
  RunService.BindToRenderStep("RotateSky", 100, (dt) => {
    t += dt;
    // TODO: hook into actual sky/lighting once implemented.
  });
}

export function stop() {
  try { RunService.UnbindFromRenderStep("RotateSky"); } catch {}
  console.log("[Client] main.client.js stopped");
}
