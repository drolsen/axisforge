import test from 'ava';
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Verify painting with undo/redo and save/load

test('terrain paint undo/redo and save/load', async t => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 100, height: 100 });

  const terrainURL = pathToFileURL(path.join(__dirname, '../src/Panels/TerrainPanel.js')).href;
  const script = `
    import TerrainPanel from '${terrainURL}';
    const panel = TerrainPanel();
    document.body.appendChild(panel);
  `;
  await page.addScriptTag({ type: 'module', content: script });

  const initial = await page.evaluate(() => Array.from(window.terrain.masks.data));

  await page.click('canvas', { position: { x: 10, y: 10 } });
  const painted = await page.evaluate(() => Array.from(window.terrain.masks.data));
  t.notDeepEqual(painted, initial);

  await page.click('#undo-btn');
  const afterUndo = await page.evaluate(() => Array.from(window.terrain.masks.data));
  t.deepEqual(afterUndo, initial);

  await page.click('#redo-btn');
  const afterRedo = await page.evaluate(() => Array.from(window.terrain.masks.data));
  t.deepEqual(afterRedo, painted);

  await page.click('#save-btn');
  await page.click('canvas', { position: { x: 20, y: 20 } });
  const modified = await page.evaluate(() => Array.from(window.terrain.masks.data));
  t.notDeepEqual(modified, painted);

  await page.click('#load-btn');
  const afterLoad = await page.evaluate(() => Array.from(window.terrain.masks.data));
  t.deepEqual(afterLoad, painted);

  await browser.close();
});
