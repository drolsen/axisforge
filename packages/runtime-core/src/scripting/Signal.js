class Signal {
  constructor() {
    this._listeners = new Set();
  }

  connect(fn) {
    this._listeners.add(fn);
    return {
      disconnect: () => {
        this._listeners.delete(fn);
      },
    };
  }

  fire(...args) {
    for (const fn of [...this._listeners]) {
      try {
        fn(...args);
      } catch (e) {
        console.error(e);
      }
    }
  }
}

export default Signal;
