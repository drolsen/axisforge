import { createServer } from 'vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function start() {
  const root = resolve(__dirname, '../examples/hello-triangle');
  const server = await createServer({ root });
  await server.listen();
  server.printUrls();
}

start();
