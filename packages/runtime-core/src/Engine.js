import AppLoop from './AppLoop.js';

class Engine {
  constructor() {
    this._systems = [];
    this._loop = new AppLoop(this._tick.bind(this));
    if (typeof document !== 'undefined' && document.addEventListener) {
      this._onVisibility = () => {
        if (document.visibilityState === 'hidden') this._loop.stop();
        else this._loop.start();
      };
      document.addEventListener('visibilitychange', this._onVisibility);
    }
  }

  add(system) {
    this._systems.push(system);
  }

  start() {
    this._loop.start();
  }

  stop() {
    this._loop.stop();
  }

  _tick(dt, time) {
    const systems = this._systems;
    for (let i = 0; i < systems.length; i++) {
      const sys = systems[i];
      if (typeof sys.update === 'function') sys.update(dt, time);
    }
    for (let i = 0; i < systems.length; i++) {
      const sys = systems[i];
      if (typeof sys.lateUpdate === 'function') sys.lateUpdate(dt, time);
    }
  }
}

export default Engine;
