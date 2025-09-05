import { chromium } from 'playwright';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import fs from 'node:fs';

function readPngOrB64(pathPng) {
  const b64Path = pathPng + '.b64';
  if (fs.existsSync(pathPng)) {
    const buf = fs.readFileSync(pathPng);
    return PNG.sync.read(buf);
  }
  if (fs.existsSync(b64Path)) {
    const raw = fs.readFileSync(b64Path, 'utf8').replace(/\s+/g, '');
    const buf = Buffer.from(raw, 'base64');
    return PNG.sync.read(buf);
  }
  throw new Error(`Missing golden: ${pathPng} or ${b64Path}`);
}

const url = 'http://localhost:5173/examples/hello-triangle/index.html';
const goldenPath = './examples/hello-triangle/golden.png';
const out = './examples/hello-triangle/output.png';
const diff = './examples/hello-triangle/output.diff.png';

async function main() {
  const browser = await chromium.launch({ args: ['--enable-unsafe-webgpu'] });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const buf = await page.screenshot({ fullPage: false });
  fs.writeFileSync(out, buf);

  const gold = readPngOrB64(goldenPath);
  const shot = PNG.sync.read(fs.readFileSync(out));
  const { width, height } = gold;
  if (shot.width !== width || shot.height !== height) {
    throw new Error(
      `Size mismatch: got ${shot.width}x${shot.height}, expected ${width}x${height}`
    );
  }
  const diffImg = new PNG({ width, height });
  const mismatched = pixelmatch(
    gold.data,
    shot.data,
    diffImg.data,
    width,
    height,
    { threshold: 0.1 }
  );
  fs.writeFileSync(diff, PNG.sync.write(diffImg));
  const pct = mismatched / (width * height);
  console.log('pixelsDifferent', mismatched, 'ratio', pct.toFixed(4));
  process.exit(pct > 0.02 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
