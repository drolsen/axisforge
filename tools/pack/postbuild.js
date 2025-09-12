import { promises as fs } from 'fs';
import path from 'path';

const pkg = JSON.parse(await fs.readFile('package.json', 'utf8'));
const latest = { version: pkg.version, notes: 'Initial scaffold' };
await fs.writeFile(path.resolve('dist/latest.json'), JSON.stringify(latest, null, 2));
