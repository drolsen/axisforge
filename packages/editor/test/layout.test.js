import test from 'ava';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Visual regression test for simple frame layout

test('frame layout snapshot', async t => {
  if (!process.env.VISUAL) {
    t.pass();
    return;
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 200, height: 200 });

  const frameURL = pathToFileURL(path.join(__dirname, '../src/UIPrimitives/Frame.js')).href;
  const strokeURL = pathToFileURL(path.join(__dirname, '../src/UIPrimitives/UIStroke.js')).href;
  const cornerURL = pathToFileURL(path.join(__dirname, '../src/UIPrimitives/UICorner.js')).href;
  const constraintURL = pathToFileURL(path.join(__dirname, '../src/UIPrimitives/UISizeConstraint.js')).href;
  const layoutURL = pathToFileURL(path.join(__dirname, '../../ui/src/LayoutEngine.js')).href;
  const udim2URL = pathToFileURL(path.join(__dirname, '../../ui/src/UDim2.js')).href;

  const script = `
    import Frame from '${frameURL}';
    import UIStroke from '${strokeURL}';
    import UICorner from '${cornerURL}';
    import UISizeConstraint from '${constraintURL}';
    import layout from '${layoutURL}';
    import UDim2 from '${udim2URL}';

    const root = new Frame({ size: new UDim2(0,200,0,200), backgroundColor: '#fff' });
    const child1 = new Frame({ position: new UDim2(0,0,0,0), size: new UDim2(0.5,0,0.5,0), backgroundColor: 'red' });
    child1.stroke = new UIStroke(4, 'black');
    child1.corner = new UICorner(10);
    const child2 = new Frame({ position: new UDim2(0.5,0,0.5,0), size: new UDim2(0.5,0,0.5,0), backgroundColor: 'blue' });
    child2.sizeConstraint = new UISizeConstraint({ maxWidth: 60, maxHeight: 60 });
    root.appendChild(child1);
    root.appendChild(child2);
    document.body.style.margin = '0';
    document.body.appendChild(root.element);
    layout(root);
  `;

  await page.addScriptTag({ type: 'module', content: script });
  const screenshot = await page.screenshot({ type: 'png', encoding: 'base64' });
  const goldenPath = path.join(__dirname, 'ui-layout.golden.png.b64');
  const golden = fs.readFileSync(goldenPath, 'utf8').trim();
  t.is(screenshot, golden);

  await browser.close();
});
