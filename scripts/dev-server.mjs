import { createServer } from 'vite';
import path from 'node:path';

const rootDir = path.resolve('examples');

const server = await createServer({
  root: rootDir,
  server: {
    open: '/hello-triangle/',
    fs: {
      allow: [path.resolve('.')]
    }
  }
});

await server.listen();
server.printUrls();
