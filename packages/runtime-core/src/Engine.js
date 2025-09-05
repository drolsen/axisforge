import { AppLoop } from './AppLoop.js';

export class Engine {
  constructor() {
    this.subsystems = [];
    this._loop = new AppLoop(this._update.bind(this));
  }

  add(subsystem) {
    this.subsystems.push(subsystem);
    return subsystem;
  }

  start() {
    this._loop.start();
  }

  stop() {
    this._loop.stop();
  }

  _update(dt, time) {
    for (const system of this.subsystems) {
      if (system && typeof system.update === 'function') {
        system.update(dt, time);
      }
    }
  }
}

export default Engine;
