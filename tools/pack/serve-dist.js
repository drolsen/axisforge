import http from 'http';
import { promises as fs } from 'fs';
import path from 'path';

const base = path.resolve('dist');
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

const port = process.env.PORT || 5000;
server.listen(port, () => console.log(`Serving dist at http://localhost:${port}`));
