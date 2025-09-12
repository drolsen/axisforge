export default class ConsolePane {
  constructor() {
    this.logs = [];
    const original = console.log;
    console.log = (...args) => {
      this.logs.push(args.join(' '));
      original(...args);
    };
  }
}
