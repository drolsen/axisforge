// Example client entry. Runs in Play mode only (loaded via ESM).
import { GetService } from "/engine/core/index.js";

// If you prefer, you can also import the RunService singleton directly:
// import { RunService } from "/engine/services/RunService.js";
const RunService = GetService("RunService");

console.log("[Client] main.client.js loaded");

let t = 0;
let logAccumulator = 0;

export function start() {
  const Lighting = GetService("Lighting");
  // Example per-frame update; replace with your own gameplay code.
  RunService.BindToRenderStep("RotateSky", 100, (dt) => {
    t += dt;
    logAccumulator += dt;
    if (logAccumulator >= 5) {
      logAccumulator = 0;
      const time = Lighting.getTimeOfDay?.();
      const angles = Lighting.getSunAngles?.();
      if (Number.isFinite(time) && angles) {
        const elevationDeg = (angles.elevation * 180) / Math.PI;
        console.log(
          `[Lighting] Time ${time.toFixed(2)}h | Sun elev ${elevationDeg.toFixed(1)}°`,
        );
      }
    }
  });
}

export function stop() {
  try { RunService.UnbindFromRenderStep("RotateSky"); } catch {}
  console.log("[Client] main.client.js stopped");
}
