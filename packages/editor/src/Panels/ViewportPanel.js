/**
 * Placeholder viewport panel. In the MVP it simply displays a coloured area
 * but can later host a WebGPU canvas for scene rendering.
 */
export default class ViewportPanel {
  constructor(container) {
    this.container = container;
    this.render();
  }

  render() {
    this.container.innerHTML = '';
    const title = document.createElement('div');
    title.textContent = 'Viewport';
    title.className = 'panel-title';
    this.container.appendChild(title);

    const body = document.createElement('div');
    body.className = 'panel-body';
    body.textContent = 'Scene view';
    body.style.height = '100%';
    body.style.background = '#222';
    body.style.color = '#fff';
    body.style.display = 'flex';
    body.style.alignItems = 'center';
    body.style.justifyContent = 'center';
    this.container.appendChild(body);
  }
}
