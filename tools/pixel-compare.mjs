import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';
import pixelmatch from 'pixelmatch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function startServer(root) {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      const urlPath = decodeURIComponent(req.url || '/');
      const filePath = path.join(root, urlPath === '/' ? '/index.html' : urlPath);
      try {
        const data = await readFile(filePath);
        const ext = path.extname(filePath);
        const type = ext === '.html'
          ? 'text/html'
          : ext === '.js'
            ? 'text/javascript'
            : ext === '.png'
              ? 'image/png'
              : 'application/octet-stream';
        res.setHeader('Content-Type', type);
        res.end(data);
      } catch {
        res.statusCode = 404;
        res.end();
      }
    });
    server.listen(0, () => {
      resolve(server);
    });
  });
}

async function run() {
  const server = await startServer(rootDir);
  const port = server.address().port;

  const tests = [
    {
      name: 'hello-triangle',
      url: `http://localhost:${port}/examples/hello-triangle/`,
      golden: path.join(rootDir, 'examples/hello-triangle/golden.b64')
    },
    {
      name: 'pbr-sponza',
      url: `http://localhost:${port}/examples/pbr-sponza/`,
      golden: path.join(rootDir, 'examples/pbr-sponza/golden.b64')
    }
  ];

  const browser = await chromium.launch({
    args: ['--enable-unsafe-webgpu'],
    headless: true
  });

  let failed = false;
  for (const t of tests) {
    const page = await browser.newPage({ viewport: { width: 640, height: 480 }, deviceScaleFactor: 1 });
    await page.goto(t.url);
    await page.waitForFunction(() => window.__rendered === true, { timeout: 5000 }).catch(() => {});
    const screenshot = await page.screenshot();

    const goldenBase64 = await readFile(t.golden, 'utf8');
    const goldenBuffer = Buffer.from(goldenBase64, 'base64');
    const goldenImg = await sharp(goldenBuffer).raw().toBuffer({ resolveWithObject: true });
    const shotImg = await sharp(screenshot).raw().toBuffer({ resolveWithObject: true });

    if (goldenImg.info.width !== shotImg.info.width || goldenImg.info.height !== shotImg.info.height) {
      console.log(`${t.name}: dimension mismatch`);
      failed = true;
      continue;
    }

    const diff = Buffer.alloc(goldenImg.info.width * goldenImg.info.height * 4);
    const diffPixels = pixelmatch(
      goldenImg.data,
      shotImg.data,
      diff,
      goldenImg.info.width,
      goldenImg.info.height,
      { threshold: 0.1 }
    );
    const percent = diffPixels / (goldenImg.info.width * goldenImg.info.height);
    console.log(`${t.name}: ${(percent * 100).toFixed(2)}% diff`);
    if (percent > 0.02) {
      failed = true;
      const diffPath = path.join(rootDir, `examples/${t.name}/diff.png`);
      await sharp(diff, {
        raw: {
          width: goldenImg.info.width,
          height: goldenImg.info.height,
          channels: 4
        }
      })
        .png()
        .toFile(diffPath);
    }
  }

  await browser.close();
  server.close();

  if (failed) {
    process.exit(1);
  }
}

run();
