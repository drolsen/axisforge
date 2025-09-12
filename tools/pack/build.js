import { promises as fs } from 'fs';
import path from 'path';

const pkg = JSON.parse(await fs.readFile('package.json', 'utf8'));
const swPath = path.resolve('dist/service-worker.js');
let sw = await fs.readFile(swPath, 'utf8');
sw = sw.replace('__VERSION__', pkg.version);
await fs.writeFile(swPath, sw);
