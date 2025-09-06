import test from 'ava';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Visual regression for brush painting

test('splat brush painting', async t => {
  if (!process.env.VISUAL) {
    t.pass();
    return;
  }
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 64, height: 64 });

  const dmPath = pathToFileURL(path.join(__dirname, '../src/DestructionMasks.js')).href;
  const srPath = pathToFileURL(path.join(__dirname, '../src/SplatRules.js')).href;

  await page.setContent(`<html><body><canvas id="c" width="64" height="64"></canvas><script type="module">
    import DestructionMasks from '${dmPath}';
    import SplatRules from '${srPath}';
    const canvas = document.getElementById('c');
    const ctx = canvas.getContext('2d');
    const masks = new DestructionMasks(64, 64);
    const rules = new SplatRules([{ height: [-1, 1], slope: [-1, 1], color: [0, 255, 0, 255] }]);
    const base = rules.evaluate(0, 0);
    if (base) masks.fill(base.color);
    masks.applyBrush(32, 32, 10, [255, 0, 0, 255]);
    const img = new ImageData(masks.data, 64, 64);
    ctx.putImageData(img, 0, 0);
  </script></body></html>`);

  const screenshot = await page.screenshot({ type: 'png', encoding: 'base64' });
  const golden = fs
    .readFileSync(
      path.join(__dirname, '../../examples/terrain-heightfield/golden-splat-brush.png.b64'),
      'utf8'
    )
    .trim();
  t.is(screenshot, golden);
  await browser.close();
});
