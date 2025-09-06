import DestructionMasks from '../../../terrain/src/DestructionMasks.js';
import SplatRules from '../../../terrain/src/SplatRules.js';

export default function TerrainPanel() {
  const el = document.createElement('div');
  el.id = 'terrain-panel';
  el.className = 'panel';
  el.innerHTML = `<div class="panel-header">Terrain</div><canvas width="64" height="64"></canvas>`;

  const canvas = el.querySelector('canvas');
  const ctx = canvas.getContext('2d');

  const masks = new DestructionMasks(64, 64);
  const rules = new SplatRules([
    { height: [-Infinity, Infinity], slope: [-Infinity, Infinity], color: [0, 255, 0, 255] }
  ]);

  const base = rules.evaluate(0, 0);
  if (base) masks.fill(base.color);

  function redraw() {
    const img = new ImageData(masks.data, masks.width, masks.height);
    ctx.putImageData(img, 0, 0);
  }

  canvas.addEventListener('click', e => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    masks.applyBrush(x, y, 10, [255, 0, 0, 255]);
    redraw();
  });

  redraw();
  return el;
}
