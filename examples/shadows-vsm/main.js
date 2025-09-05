import { createMomentMap, blurMomentMap, computeShadowFactor } from '../../packages/renderer-webgpu/src/Lighting/ShadowsVSM.js';

function draw(data, size) {
  const canvas = document.getElementById('gfx');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = Math.max(0, Math.min(1, data[i]));
    const c = Math.round(v * 255);
    img.data[i * 4] = c;
    img.data[i * 4 + 1] = c;
    img.data[i * 4 + 2] = c;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  window.__rendered = true;
}

function run(bias, blur) {
  const size = 64;
  const depth = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      depth[y * size + x] = x < size / 2 ? 1.0 : 0.5;
    }
  }

  const moments = createMomentMap(depth, size, size);
  blurMomentMap(moments, size, size, blur);

  const planeDepth = 0.75;
  const result = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    const m1 = moments[2 * i];
    const m2 = moments[2 * i + 1];
    result[i] = computeShadowFactor(planeDepth, m1, m2, bias);
  }

  draw(result, size);
}

const params = new URLSearchParams(window.location.search);
const bias = parseFloat(params.get('bias') || '0');
const blur = parseInt(params.get('blur') || '0');
run(bias, blur);
