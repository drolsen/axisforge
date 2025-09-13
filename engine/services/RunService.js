import { Signal } from '../core/signal.js';

export default class RunService {
  constructor() {
    this.Heartbeat = new Signal();
    this.RenderStepped = new Signal();
    this.Stepped = new Signal();

    this._time = 0;
    this._steps = [];

    this.BindToRenderStep = (name, priority, fn) => {
      this.UnbindFromRenderStep(name);
      this._steps.push({ name, priority, fn });
      this._steps.sort((a, b) => a.priority - b.priority);
    };

    this.UnbindFromRenderStep = name => {
      const idx = this._steps.findIndex(s => s.name === name);
      if (idx !== -1) this._steps.splice(idx, 1);
    };

    this._step = dt => {
      this._time += dt;
      if (process.env.NODE_ENV !== 'production') {
        console.log('RunService Stepped');
      }
      this.Stepped.Fire(this._time, dt);
      for (const step of this._steps) {
        try {
          step.fn(dt);
        } catch (e) {
          console.error(e);
        }
      }
      if (process.env.NODE_ENV !== 'production') {
        console.log('RunService RenderStepped');
      }
      this.RenderStepped.Fire(dt);
    };

    this._heartbeat = dt => {
      if (process.env.NODE_ENV !== 'production') {
        console.log('RunService Heartbeat');
      }
      this.Heartbeat.Fire(dt);
    };
  }
}

