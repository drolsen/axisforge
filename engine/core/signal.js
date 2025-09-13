class Signal {
  constructor() {
    this.connections = new Set();
  }

  Connect(fn) {
    const connection = {
      connected: true,
      Disconnect: () => {
        if (connection.connected) {
          connection.connected = false;
          this.connections.delete(connection);
        }
      },
      fn,
    };
    this.connections.add(connection);
    return connection;
  }

  Once(fn) {
    const connection = this.Connect((...args) => {
      connection.Disconnect();
      fn(...args);
    });
    return connection;
  }

  Wait() {
    return new Promise(resolve => this.Once(resolve));
  }

  Fire(...args) {
    for (const connection of Array.from(this.connections)) {
      try {
        connection.fn(...args);
      } catch (e) {
        // swallow errors to not break other listeners
        console.error(e);
      }
    }
  }

  DisconnectAll() {
    for (const connection of this.connections) {
      connection.connected = false;
    }
    this.connections.clear();
  }
}

export { Signal };
