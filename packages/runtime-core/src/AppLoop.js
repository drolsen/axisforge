class AppLoop {
  constructor(step) {
    this._step = step;
    this._running = false;
    this._handle = null;
    this._last = 0;
    this._loop = this._loop.bind(this);
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._last = this._now();
    this._handle = this._raf(this._loop);
  }

  stop() {
    if (!this._running) return;
    this._running = false;
    if (this._handle !== null) {
      this._cancel(this._handle);
      this._handle = null;
    }
  }

  _loop(ts) {
    if (!this._running) return;
    const now = this._now(ts);
    const dt = now - this._last;
    this._last = now;
    this._step(dt, now);
    this._handle = this._raf(this._loop);
  }

  _now(ts) {
    if (typeof ts === 'number') return ts / 1000;
    if (typeof performance !== 'undefined' && performance.now) {
      return performance.now() / 1000;
    }
    return Date.now() / 1000;
  }

  _raf(cb) {
    const raf = globalThis.requestAnimationFrame;
    if (raf) return raf(cb);
    return setTimeout(() => cb(Date.now()), 16);
  }

  _cancel(id) {
    const caf = globalThis.cancelAnimationFrame;
    if (caf) caf(id);
    else clearTimeout(id);
  }
}

export default AppLoop;
