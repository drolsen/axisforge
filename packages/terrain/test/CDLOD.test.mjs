import test from 'ava';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import HeightfieldCDLOD from '../src/HeightfieldCDLOD.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Unit test for LOD ranges

test('LOD selection ranges', t => {
  const hf = new HeightfieldCDLOD({ lodRanges: [50, 100, 200, 400] });
  t.is(hf.getLOD(10), 0);
  t.is(hf.getLOD(75), 1);
  t.is(hf.getLOD(150), 2);
  t.is(hf.getLOD(300), 3);
});

// Visual regression tests for each distance
const cases = [
  { name: 'near', dist: 10 },
  { name: 'mid', dist: 75 },
  { name: 'far', dist: 150 },
  { name: 'veryfar', dist: 300 }
];

test('visual LOD colors', async t => {
  if (!process.env.VISUAL) {
    t.pass();
    return;
  }
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 64, height: 64 });
  const examplePath = path.join(
    __dirname,
    '../../examples/terrain-heightfield/index.html'
  );
  for (const c of cases) {
    const url = pathToFileURL(examplePath).href + `?dist=${c.dist}`;
    await page.goto(url, { waitUntil: 'networkidle' });
    const screenshot = await page.screenshot({ type: 'png', encoding: 'base64' });
    const golden = fs
      .readFileSync(
        path.join(
          __dirname,
          `../../examples/terrain-heightfield/golden-${c.name}.png.b64`
        ),
        'utf8'
      )
      .trim();
    t.is(screenshot, golden);
  }
  await browser.close();
});
