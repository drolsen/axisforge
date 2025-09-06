import Signal from './Signal.js';

// Simple sandboxed script loader with hot-reload support.
class ScriptContext {
  constructor(env = {}) {
    this.env = env;
    this._scripts = new Map();
    this.changed = new Signal();
  }

  // Load or reload a script by name.
  load(name, code) {
    const existing = this._scripts.get(name);
    if (existing && typeof existing.dispose === 'function') {
      try {
        existing.dispose();
      } catch (e) {
        console.error(e);
      }
    }

    const sandbox = { ...this.env, Signal };
    const module = { exports: {} };
    const keys = Object.keys(sandbox);
    const values = Object.values(sandbox);
    const func = new Function('exports', 'module', ...keys, code);
    func(module.exports, module, ...values);
    const script = module.exports.default || module.exports;
    let dispose;
    if (typeof script === 'function') {
      dispose = script();
    }
    this._scripts.set(name, { dispose });
    this.changed.fire(name);
  }
}

export default ScriptContext;
