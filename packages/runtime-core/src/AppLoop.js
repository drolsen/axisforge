export class AppLoop {
  constructor(callback) {
    this.callback = callback;
    this._running = false;
    this._id = null;
    this._lastTime = 0;

    this._boundLoop = this._loop.bind(this);
    this._visibilityHandler = this._handleVisibilityChange.bind(this);
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._lastTime = typeof performance !== 'undefined' ? performance.now() : 0;
    this._id = requestAnimationFrame(this._boundLoop);

    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', this._visibilityHandler);
    }
  }

  stop() {
    if (!this._running) return;
    this._running = false;
    if (this._id != null) {
      cancelAnimationFrame(this._id);
      this._id = null;
    }

    if (typeof document !== 'undefined' && document.removeEventListener) {
      document.removeEventListener('visibilitychange', this._visibilityHandler);
    }
  }

  _handleVisibilityChange() {
    if (!this._running || typeof document === 'undefined') return;

    if (document.visibilityState === 'hidden') {
      if (this._id != null) {
        cancelAnimationFrame(this._id);
        this._id = null;
      }
    } else {
      this._lastTime = typeof performance !== 'undefined' ? performance.now() : 0;
      this._id = requestAnimationFrame(this._boundLoop);
    }
  }

  _loop(time) {
    if (!this._running) return;

    const dt = time - this._lastTime;
    this._lastTime = time;
    this.callback(dt, time);

    if (this._running) {
      this._id = requestAnimationFrame(this._boundLoop);
    }
  }
}

export default AppLoop;
