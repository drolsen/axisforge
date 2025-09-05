import test from 'ava';
import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const toFileUrl = p => pathToFileURL(path.resolve(p)).href;

test('layout engine positions frame', async t => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const frameURL = toFileUrl('packages/ui/src/components/Frame.js');
  const udim2URL = toFileUrl('packages/ui/src/UDim2.js');
  const layoutURL = toFileUrl('packages/ui/src/LayoutEngine.js');

  const result = await page.evaluate(async ({ frameURL, udim2URL, layoutURL }) => {
    const { Frame } = await import(frameURL);
    const { UDim2 } = await import(udim2URL);
    const { LayoutEngine } = await import(layoutURL);

    document.body.style.margin = '0';
    const root = document.createElement('div');
    root.style.position = 'relative';
    root.style.width = '200px';
    root.style.height = '200px';
    document.body.appendChild(root);

    const engine = new LayoutEngine(root);
    const frame = new Frame();
    frame.size = new UDim2(0.5, 10, 0.5, 20);
    frame.position = new UDim2(0.25, 5, 0.25, 10);
    engine.add(frame);
    engine.update();
    const rect = frame.element.getBoundingClientRect();
    return { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) };
  }, { frameURL, udim2URL, layoutURL });

  await browser.close();
  t.deepEqual(result, { x: 55, y: 60, width: 110, height: 120 });
});
