import { promises as fs } from 'fs';
import path from 'path';

const incomingDir = path.resolve('assets/_incoming');
const outDir = path.resolve('public/assets');

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full);
    } else if (entry.isFile()) {
      const match = entry.name.match(/(.+\..+)\.b64$/);
      if (match) {
        const data = await fs.readFile(full, 'utf8');
        const buffer = Buffer.from(data, 'base64');
        await fs.mkdir(outDir, { recursive: true });
        await fs.writeFile(path.join(outDir, match[1]), buffer);
        await fs.unlink(full);
      }
    }
  }
}

walk(incomingDir).catch(err => {
  console.error(err);
  process.exit(1);
});
