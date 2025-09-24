import { Signal } from "../core/signal.js";
import { nowMs } from "../core/env.js";

class _RunService {
  constructor() {
    this.Heartbeat = new Signal();
    this.RenderStepped = new Signal();
    this.Stepped = new Signal();

    this._renderBindings = []; // { name, priority, fn }
    this._last = null;
    this._running = true; // drive by renderer
  }

  BindToRenderStep(name, priority, fn) {
    if (this._renderBindings.find(b => b.name === name)) {
      throw new Error(`[RunService] Binding '${name}' already exists`);
    }
    this._renderBindings.push({ name, priority, fn });
    this._renderBindings.sort((a, b) => a.priority - b.priority);
  }

  UnbindFromRenderStep(name) {
    this._renderBindings = this._renderBindings.filter(b => b.name !== name);
  }

  // Called once per animation frame by renderer
  _step() {
    const t = nowMs();
    const last = this._last ?? t;
    let dt = (t - last) / 1000;
    // Clamp dt to avoid long stalls exploding simulations
    if (!isFinite(dt) || dt < 0) dt = 0;
    if (dt > 0.25) dt = 0.25;
    this._last = t;

    // Classic order: Stepped -> bound render steps -> RenderStepped -> Heartbeat
    try {
      this.Stepped.Fire(t, dt);
      for (const b of this._renderBindings) {
        b.fn(dt);
      }
      this.RenderStepped.Fire(dt);
      this.Heartbeat.Fire(dt);
    } catch (err) {
      // Surface but do not break the loop
      console.error("[RunService] step error", err);
    }
  }
}

export const RunService = new _RunService();
