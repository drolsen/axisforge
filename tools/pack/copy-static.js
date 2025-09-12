import { promises as fs } from 'fs';
import path from 'path';
import rimraf from 'rimraf';

const srcDir = path.resolve('public');
const destDir = path.resolve('dist');

rimraf.sync(destDir);

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

copy(srcDir, destDir).catch(err => {
  console.error(err);
  process.exit(1);
});
