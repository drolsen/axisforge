import test from 'ava';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import ShadowsVSM from '../src/Lighting/ShadowsVSM.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const goldenDir = path.join(__dirname, 'golden');

function toPngBase64(arr) {
  const h = arr.length;
  const w = arr[0].length;
  const data = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = Math.round(arr[y][x] * 255);
      const idx = (y * w + x) * 4;
      data[idx] = v;
      data[idx + 1] = v;
      data[idx + 2] = v;
      data[idx + 3] = 255;
    }
  }
  return sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toBuffer()
    .then((buf) => buf.toString('base64'));
}

function createScene() {
  const depth = [
    [0.4, 0.4, 0.6, 0.6],
    [0.4, 0.4, 0.6, 0.6],
    [0.4, 0.4, 0.6, 0.6],
    [0.4, 0.4, 0.6, 0.6]
  ];
  const receiver = Array.from({ length: 4 }, () => Array(4).fill(0.5));
  return { depth, receiver };
}

test('hard edge matches golden', async (t) => {
  const { depth, receiver } = createScene();
  const vsm = new ShadowsVSM({ softness: 0, bias: 0 });
  const moments = vsm.momentsFromDepth(depth);
  const blurred = vsm.blurMoments(moments);
  const shadow = vsm.shadowFactor(receiver, blurred);
  const b64 = await toPngBase64(shadow);
  const golden = (await readFile(path.join(goldenDir, 'shadow-hard.b64'), 'utf8')).trim();
  t.is(b64, golden);
});

test('soft edge matches golden', async (t) => {
  const { depth, receiver } = createScene();
  const vsm = new ShadowsVSM({ softness: 1, bias: 0 });
  const moments = vsm.momentsFromDepth(depth);
  const blurred = vsm.blurMoments(moments);
  const shadow = vsm.shadowFactor(receiver, blurred);
  const b64 = await toPngBase64(shadow);
  const golden = (await readFile(path.join(goldenDir, 'shadow-soft.b64'), 'utf8')).trim();
  t.is(b64, golden);
});
