import test from 'ava';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(__dirname, 'fixture.html');

/*test('panels render and layout persists', async t => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('file://' + fixture);

  await page.waitForSelector('#explorer-panel');
  await page.waitForSelector('#properties-panel');
  await page.waitForSelector('#viewport-panel');
  await page.waitForSelector('#console-panel');

  await page.evaluate(() => window.appShell.movePanel('console', 'right'));
  await page.reload();
  await page.waitForSelector('#console-panel');
  const zone = await page.evaluate(() => document.getElementById('console-panel').parentElement.className);
  t.true(zone.includes('right'));

  await browser.close();
});*/
