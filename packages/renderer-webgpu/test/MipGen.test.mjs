import test from 'ava';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import pixelmatch from 'pixelmatch';
import { generate } from '../src/Textures/MipGen.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createChecker(width, height) {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const v = (x + y) % 2 === 0 ? 0 : 255;
      data[idx] = v;
      data[idx + 1] = v;
      data[idx + 2] = v;
      data[idx + 3] = 255;
    }
  }
  return data;
}

test('mip level count', t => {
  const width = 4;
  const height = 4;
  const data = createChecker(width, height);
  const mips = generate(null, { width, height, data });
  t.is(mips.length, 3); // 4x4 -> 2x2 -> 1x1
});

test('downscale reduces aliasing', async t => {
  const width = 4;
  const height = 4;
  const data = createChecker(width, height);
  const mips = generate(null, { width, height, data });
  const level1 = mips[1];
  const actualPng = await sharp(level1, { raw: { width: 2, height: 2, channels: 4 } })
    .png()
    .toBuffer();
  const actualRaw = await sharp(actualPng).raw().toBuffer();

  const goldenPath = path.resolve(__dirname, '../../../examples/pbr-sponza/golden-mips.png.b64');
  const goldenBase64 = fs.readFileSync(goldenPath, 'utf8').trim();
  const goldenPng = Buffer.from(goldenBase64, 'base64');
  const goldenRaw = await sharp(goldenPng).raw().toBuffer();

  const diff = pixelmatch(actualRaw, goldenRaw, null, 2, 2, { threshold: 0 });
  t.is(diff, 0);
});
