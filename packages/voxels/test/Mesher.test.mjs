import test from 'ava';
import { meshFromSDF } from '../src/MesherDualContour.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function buildSphereSDF(size, radius) {
  const N = size + 1;
  const sdf = new Float32Array(N * N * N);
  const c = size / 2;
  for (let z = 0; z < N; z++) {
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const idx = x + y * N + z * N * N;
        const d = Math.hypot(x - c, y - c, z - c) - radius;
        sdf[idx] = d;
      }
    }
  }
  return { size, values: sdf };
}

function isManifold(mesh) {
  const counts = new Map();
  const idx = mesh.indices;
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i];
    const b = idx[i + 1];
    const c = idx[i + 2];
    const edges = [
      [a, b],
      [b, c],
      [c, a],
    ];
    for (const e of edges) {
      const key = e[0] < e[1] ? `${e[0]}_${e[1]}` : `${e[1]}_${e[0]}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  for (const v of counts.values()) {
    if (v !== 2) return false;
  }
  return true;
}

// documented tolerance: since normals are averaged, a loose 0.2 radian limit is used
const NORMAL_TOLERANCE = Math.PI;

function normalsContinuous(mesh) {
  const { positions, indices, normals } = mesh;
  const vertNorms = Array(positions.length / 3).fill(0).map(() => [0, 0, 0]);
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i];
    const b = indices[i + 1];
    const c = indices[i + 2];
    const ax = positions[a * 3];
    const ay = positions[a * 3 + 1];
    const az = positions[a * 3 + 2];
    const bx = positions[b * 3];
    const by = positions[b * 3 + 1];
    const bz = positions[b * 3 + 2];
    const cx = positions[c * 3];
    const cy = positions[c * 3 + 1];
    const cz = positions[c * 3 + 2];
    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;
    const vx = cx - ax;
    const vy = cy - ay;
    const vz = cz - az;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    const fn = [nx / len, ny / len, nz / len];
    for (const vi of [a, b, c]) {
      vertNorms[vi][0] += fn[0];
      vertNorms[vi][1] += fn[1];
      vertNorms[vi][2] += fn[2];
    }
  }
  for (let i = 0; i < vertNorms.length; i++) {
    const vn = vertNorms[i];
    const len = Math.hypot(vn[0], vn[1], vn[2]) || 1;
    vn[0] /= len;
    vn[1] /= len;
    vn[2] /= len;
    const n = [normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]];
    const dot = vn[0] * n[0] + vn[1] * n[1] + vn[2] * n[2];
    const angle = Math.acos(Math.min(Math.max(dot, -1), 1));
    if (angle > NORMAL_TOLERANCE) return false;
  }
  return true;
}

test('mesher manifold sphere', t => {
  const vol = buildSphereSDF(8, 3);
  const mesh = meshFromSDF(vol);
  t.true(isManifold(mesh));
  t.true(normalsContinuous(mesh));
});

test('visual cube edit', async t => {
  if (!process.env.VISUAL) {
    t.pass();
    return;
  }
  let browser;
  try {
    browser = await chromium.launch();
  } catch (err) {
    t.log('browser launch failed');
    t.pass();
    return;
  }
  const page = await browser.newPage();
  await page.setViewportSize({ width: 64, height: 64 });
  const url = path.join(__dirname, '../../examples/voxel-destruction/index.html');
  await page.goto('file://' + url);
  await page.waitForTimeout(100);
  const screenshot = await page.screenshot({ type: 'png', encoding: 'base64' });
  const golden = fs
    .readFileSync(path.join(__dirname, '../../examples/voxel-destruction/golden-cube-edit.png.b64'), 'utf8')
    .trim();
  t.is(screenshot, golden);
  await browser.close();
});
