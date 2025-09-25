export default class ConsolePane {
  constructor() {
    this.logs = [];
    this._listeners = new Set();
    const original = console.log;
    console.log = (...args) => {
      const entry = args.join(' ');
      this.logs.push(entry);
      this._emit(entry);
      original(...args);
    };
  }

  onLog(listener) {
    if (typeof listener !== 'function') {
      return () => {};
    }
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  getEntries() {
    return [...this.logs];
  }

  clear() {
    this.logs = [];
    this._emit(null);
  }

  _emit(entry) {
    for (const listener of this._listeners) {
      try {
        listener(entry, this.getEntries());
      } catch (err) {
        console.error('[ConsolePane] onLog listener error', err);
      }
    }
  }
}
