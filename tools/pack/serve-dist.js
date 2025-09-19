import http from 'http';
import { promises as fs } from 'fs';
import path from 'path';

const distRoot = path.resolve('dist');
const indexPath = path.join(distRoot, 'index.html');

const mimeTypes = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
};

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return mimeTypes[ext] ?? 'application/octet-stream';
}

async function trySendFile(res, filePath) {
  try {
    const data = await fs.readFile(filePath);
    res.statusCode = 200;
    res.setHeader('Content-Type', getContentType(filePath));
    res.end(data);
    return true;
  } catch (err) {
    if (err.code !== 'ENOENT') {
      res.statusCode = 500;
      res.end('Server error');
      return true;
    }
  }
  return false;
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(requestUrl.pathname);

  if (pathname === '/' || pathname === '') {
    if (await trySendFile(res, indexPath)) {
      return;
    }
    res.statusCode = 500;
    res.end('Index not found');
    return;
  }

  const normalized = path
    .normalize(pathname)
    .replace(/^([.][.][/\\])+/, '')
    .replace(/^[/\\]+/, '');

  const candidate = path.join(distRoot, normalized);
  if (candidate.startsWith(distRoot) && (await trySendFile(res, candidate))) {
    return;
  }

  res.statusCode = 404;
  res.end('Not found');
});

const port = process.env.PORT || 5000;
server.listen(port, () => console.log(`Serving dist at http://localhost:${port}`));
