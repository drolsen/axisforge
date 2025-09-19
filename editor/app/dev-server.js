import http from 'http';
import { promises as fs } from 'fs';
import path from 'path';

const repoRoot = path.resolve('.');
const publicDir = path.resolve('public');
const indexPath = path.join(publicDir, 'index.html');

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

  const repoCandidate = path.join(repoRoot, normalized);
  if (repoCandidate.startsWith(repoRoot) && (await trySendFile(res, repoCandidate))) {
    return;
  }

  const publicCandidate = path.join(publicDir, normalized);
  if (publicCandidate.startsWith(publicDir) && (await trySendFile(res, publicCandidate))) {
    return;
  }

  res.statusCode = 404;
  res.end('Not found');
});

const port = process.env.PORT || 8080;
server.listen(port, () => console.log(`Dev server running at http://localhost:${port}`));
