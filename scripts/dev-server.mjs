import { createServer } from 'vite';

async function start() {
  const server = await createServer({
    root: 'examples/hello-triangle',
  });
  await server.listen();
  server.printUrls();
}

start();
