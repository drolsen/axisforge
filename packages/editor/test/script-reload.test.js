import test from 'ava';
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ensure editing the script updates behavior without page reload.

test('script hot reload', async t => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const panelURL = pathToFileURL(path.join(__dirname, '../src/Panels/ScriptEditorPanel.js')).href;
  const ctxURL = pathToFileURL(path.join(__dirname, '../../runtime-core/src/scripting/ScriptContext.js')).href;

  const setup = `
    import ScriptEditorPanel from '${panelURL}';
    import ScriptContext from '${ctxURL}';
    const ctx = new ScriptContext();
    const panel = ScriptEditorPanel(ctx, 'Main');
    document.body.appendChild(panel);
    const out = document.createElement('div');
    out.id = 'out';
    document.body.appendChild(out);
    window.ctx = ctx; // expose for debugging
  `;
  await page.addScriptTag({ type: 'module', content: setup });

  // initial script
  await page.evaluate(() => {
    const textarea = document.querySelector('textarea');
    textarea.value = "document.getElementById('out').textContent = 'A';";
    textarea.dispatchEvent(new Event('input'));
  });
  t.is(await page.textContent('#out'), 'A');

  // edit script to update DOM
  await page.evaluate(() => {
    const textarea = document.querySelector('textarea');
    textarea.value = "document.getElementById('out').textContent = 'B';";
    textarea.dispatchEvent(new Event('input'));
  });
  t.is(await page.textContent('#out'), 'B');

  await browser.close();
});
