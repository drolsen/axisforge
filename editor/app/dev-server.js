import http from 'http';
import { promises as fs } from 'fs';
import path from 'path';

const base = path.resolve('public');
const server = http.createServer(async (req, res) => {
  const filePath = path.join(base, req.url === '/' ? '/index.html' : req.url);
  try {
    const data = await fs.readFile(filePath);
    res.end(data);
  } catch (err) {
    res.statusCode = 404;
    res.end('Not found');
  }
});

const port = process.env.PORT || 8080;
server.listen(port, () => console.log(`Dev server running at http://localhost:${port}`));
