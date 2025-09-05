export default class Signal {
  constructor() {
    this.listeners = new Set();
  }

  add(listener) {
    this.listeners.add(listener);
  }

  remove(listener) {
    this.listeners.delete(listener);
  }

  dispatch(...args) {
    for (const l of [...this.listeners]) {
      try {
        l(...args);
      } catch (err) {
        console.error(err);
      }
    }
  }
}
