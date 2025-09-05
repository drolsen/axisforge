import Signal from './Signal.js';

/**
 * Simple sandboxed script context with a minimal module system. Scripts are
 * stored by name and evaluated in isolated functions with a shared `globals`
 * object that persists across reloads. The context exposes an `onExecuted`
 * signal which fires whenever a script is (re)executed.
 */
export default class ScriptContext {
  constructor() {
    this.scripts = new Map();
    this.globals = {};
    this.onExecuted = new Signal();
  }

  /**
     * Load or update a script by name. The script will be immediately
     * executed. Subsequent calls with the same name replace the module
     * source but preserve the shared globals object.
     */
  setScript(name, source) {
    this.scripts.set(name, { source, exports: {} });
    this.#run(name);
  }

  /** Run a script and update its exports */
  #run(name) {
    const mod = this.scripts.get(name);
    if (!mod) throw new Error(`Unknown script '${name}'`);
    const module = { exports: {} };
    const require = dep => {
      if (!this.scripts.has(dep)) throw new Error(`Module '${dep}' not found`);
      this.#run(dep);
      return this.scripts.get(dep).exports;
    };
    const fn = new Function('module', 'exports', 'require', 'globals', 'Signal', mod.source);
    fn(module, module.exports, require, this.globals, Signal);
    mod.exports = module.exports;
    this.onExecuted.dispatch(name);
  }
}
