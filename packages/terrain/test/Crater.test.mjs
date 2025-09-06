import test from 'ava';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('crater compute', async t => {
  if (!process.env.VISUAL) {
    t.pass();
    return;
  }
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 64, height: 64 });

  const dmPath = pathToFileURL(path.join(__dirname, '../src/DestructionMasks.js')).href;

  await page.setContent(`<html><body><canvas id="c" width="64" height="64"></canvas><script type="module">
    import DestructionMasks from '${dmPath}';
    const canvas = document.getElementById('c');
    const ctx = canvas.getContext('2d');
    const masks = new DestructionMasks(64,64);
    masks.applyCrater(20,20,8,1.0);
    masks.applyCrater(44,20,5,1.0);
    masks.applyCrater(32,40,7,1.0);
    masks.applyCrater(32,40,7,1.0);
    const img = masks.toImageData();
    ctx.putImageData(img,0,0);
  </script></body></html>`);

  const screenshot = await page.screenshot({ type: 'png', encoding: 'base64' });
  const golden = fs
    .readFileSync(path.join(__dirname, '../../examples/terrain-heightfield/golden-craters.png.b64'), 'utf8')
    .trim();
  t.is(screenshot, golden);
  await browser.close();
});
