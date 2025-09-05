/**
 * Simple console panel capturing messages written to `console.log`. In the
 * MVP it only displays logged text lines.
 */
export default class ConsolePanel {
  constructor(container) {
    this.container = container;
    this.render();
    this.#hookConsole();
  }

  render() {
    this.container.innerHTML = '';
    const title = document.createElement('div');
    title.textContent = 'Console';
    title.className = 'panel-title';
    this.container.appendChild(title);

    this.body = document.createElement('div');
    this.body.className = 'panel-body';
    this.body.style.height = '100%';
    this.body.style.overflow = 'auto';
    this.container.appendChild(this.body);
  }

  #hookConsole() {
    const original = console.log;
    console.log = (...args) => {
      original.apply(console, args);
      const line = document.createElement('div');
      line.textContent = args.join(' ');
      this.body.appendChild(line);
      this.body.scrollTop = this.body.scrollHeight;
    };
  }
}
