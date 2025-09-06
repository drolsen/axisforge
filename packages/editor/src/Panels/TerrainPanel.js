import DestructionMasks from '../../../terrain/src/DestructionMasks.js';
import SplatRules from '../../../terrain/src/SplatRules.js';
import UndoRedo from '../Commands/UndoRedo.js';

export default function TerrainPanel() {
  const el = document.createElement('div');
  el.id = 'terrain-panel';
  el.className = 'panel';
  el.innerHTML = `
    <div class="panel-header">Terrain</div>
    <div class="panel-body">
      <div class="controls">
        <label>Size <input type="range" id="brush-size" min="1" max="32" value="10"></label>
        <label>Strength <input type="range" id="brush-strength" min="0" max="1" step="0.01" value="1"></label>
        <label>Falloff <input type="range" id="brush-falloff" min="0" max="1" step="0.01" value="0.5"></label>
        <button id="undo-btn">Undo</button>
        <button id="redo-btn">Redo</button>
        <button id="save-btn">Save</button>
        <button id="load-btn">Load</button>
      </div>
      <canvas width="64" height="64"></canvas>
    </div>`;

  const canvas = el.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const sizeInput = el.querySelector('#brush-size');
  const strengthInput = el.querySelector('#brush-strength');
  const falloffInput = el.querySelector('#brush-falloff');
  const undoBtn = el.querySelector('#undo-btn');
  const redoBtn = el.querySelector('#redo-btn');
  const saveBtn = el.querySelector('#save-btn');
  const loadBtn = el.querySelector('#load-btn');

  const masks = new DestructionMasks(64, 64);
  let rules = new SplatRules([
    { height: [-Infinity, Infinity], slope: [-Infinity, Infinity], color: [0, 255, 0, 255] }
  ]);
  const stack = new UndoRedo();

  const base = rules.evaluate(0, 0);
  if (base) masks.fill(base.color);

  function redraw() {
    const img = new ImageData(masks.data, masks.width, masks.height);
    ctx.putImageData(img, 0, 0);
  }

  function paint(x, y) {
    const radius = parseInt(sizeInput.value, 10);
    const strength = parseFloat(strengthInput.value);
    const falloff = parseFloat(falloffInput.value);
    const color = [255, 0, 0, 255];

    const before = new Uint8ClampedArray(masks.data);
    for (let j = 0; j < masks.height; j++) {
      for (let i = 0; i < masks.width; i++) {
        const dx = i - x;
        const dy = j - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= radius) {
          const t = 1 - dist / radius;
          const f = Math.pow(t, falloff * 4 + 1) * strength;
          const idx = (j * masks.width + i) * 4;
          for (let k = 0; k < 4; k++) {
            const current = masks.data[idx + k];
            const target = color[k];
            masks.data[idx + k] = Math.round(current + (target - current) * f);
          }
        }
      }
    }
    redraw();
    const after = new Uint8ClampedArray(masks.data);
    stack.push({
      undo: () => {
        masks.data.set(before);
        redraw();
      },
      redo: () => {
        masks.data.set(after);
        redraw();
      }
    });
  }

  canvas.addEventListener('click', e => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    paint(x, y);
  });

  undoBtn.addEventListener('click', () => stack.undo());
  redoBtn.addEventListener('click', () => stack.redo());

  saveBtn.addEventListener('click', () => {
    const json = JSON.stringify({
      width: masks.width,
      height: masks.height,
      data: Array.from(masks.data),
      rules: rules.serialize()
    });
    window.lastTerrainSave = json;
  });

  loadBtn.addEventListener('click', () => {
    if (!window.lastTerrainSave) return;
    const obj = JSON.parse(window.lastTerrainSave);
    masks.data.set(obj.data);
    rules = SplatRules.deserialize(obj.rules);
    redraw();
  });

  redraw();

  window.terrain = {
    get masks() {
      return masks;
    },
    get rules() {
      return rules;
    },
    stack,
    canvas
  };

  return el;
}
