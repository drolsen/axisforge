#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const INCOMING_DIR = path.join(process.cwd(), 'assets', '_incoming');
const SIG = {
  '.png': (b) =>
    b.length >= 8 &&
    b
      .slice(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  '.jpg': (b) =>
    b.length >= 3 && b.slice(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  '.jpeg': (b) =>
    b.length >= 3 && b.slice(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  '.gif': (b) =>
    b.length >= 6 &&
    (b.slice(0, 6).toString('ascii') === 'GIF87a' ||
      b.slice(0, 6).toString('ascii') === 'GIF89a'),
  '.webp': (b) =>
    b.length >= 12 &&
    b.slice(0, 4).toString('ascii') === 'RIFF' &&
    b.slice(8, 12).toString('ascii') === 'WEBP',
};
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    const s = fs.statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (n.endsWith('.b64')) out.push(p);
  }
  return out;
}
function ensureDir(p) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
}
function decodeOne(src) {
  const raw = fs.readFileSync(src, 'utf8').replace(/\s+/g, '');
  const base = path.basename(src).replace(/\.b64$/, ''); // e.g. foo.png
  const ext = path.extname(base).toLowerCase();
  const rel = path.relative(INCOMING_DIR, src).replace(/\.b64$/, ''); // keep folder structure
  const out = path.join(
    process.cwd(),
    'assets',
    rel.replace(/^_incoming[\\/]/, '')
  );
  const buf = Buffer.from(raw, 'base64');
  if (SIG[ext] && !SIG[ext](buf))
    throw new Error(`Signature check failed for ${src} (${ext})`);
  ensureDir(out);
  fs.writeFileSync(out, buf);
  fs.unlinkSync(src);
  const sha = crypto.createHash('sha256').update(buf).digest('hex');
  console.log(`Decoded: ${out} (${buf.length} bytes) sha256=${sha}`);
}
const files = walk(INCOMING_DIR);
if (!files.length) {
  console.log('No *.b64 assets found. Nothing to decode.');
  process.exit(2);
}
for (const f of files) decodeOne(f);
