import { promises as fs } from 'fs';
import path from 'path';
import { rimraf } from 'rimraf';

const destDir = path.resolve('dist');
const sources = [
  { src: path.resolve('public'), dest: destDir },
  { src: path.resolve('editor'), dest: path.join(destDir, 'editor') },
  { src: path.resolve('engine'), dest: path.join(destDir, 'engine') },
];

function sanitizeRelative(base, target) {
  const relative = path.relative(base, target);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

async function copy(src, dest) {
  const entries = await fs.readdir(src, { withFileTypes: true });
  await fs.mkdir(dest, { recursive: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copy(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function main() {
  rimraf.sync(destDir);

  for (const { src, dest } of sources) {
    if (!sanitizeRelative(process.cwd(), src)) {
      throw new Error(`Refusing to copy from outside project root: ${src}`);
    }
    await copy(src, dest);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
