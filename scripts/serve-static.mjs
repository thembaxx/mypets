import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve('out');
const port = Number(process.env.PORT || 3000);
const types = {
  '.html': 'text/html;charset=utf-8',
  '.js': 'text/javascript;charset=utf-8',
  '.css': 'text/css;charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain;charset=utf-8',
  '.md': 'text/plain;charset=utf-8',
  '.xml': 'application/xml;charset=utf-8',
};
if (!fs.existsSync(path.join(root, 'index.html')))
  throw new Error('Run npm run build before starting the production server.');
http
  .createServer((request, response) => {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405);
      response.end();
      return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    } catch {
      response.writeHead(400);
      response.end();
      return;
    }
    let filename = path.resolve(root, '.' + pathname);
    if (filename !== root && !filename.startsWith(root + path.sep)) {
      response.writeHead(403);
      response.end();
      return;
    }
    if (fs.existsSync(filename) && fs.statSync(filename).isDirectory())
      filename = path.join(filename, 'index.html');
    if (!fs.existsSync(filename)) {
      response.writeHead(404, { 'Content-Type': 'text/html;charset=utf-8' });
      fs.createReadStream(path.join(root, '404.html')).pipe(response);
      return;
    }
    const size = fs.statSync(filename).size;
    const headers = {
      'Content-Type': types[path.extname(filename)] || 'application/octet-stream',
      'Cache-Control': pathname.startsWith('/_next/static/')
        ? 'public,max-age=31536000,immutable'
        : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Content-Length': size,
    };
    if (path.extname(filename) === '.mp4') {
      headers['Accept-Ranges'] = 'bytes';
      const range = request.method === 'GET' && request.headers.range;
      const match = range && /^bytes=(\d*)-(\d*)$/.exec(range);
      if (match) {
        const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
        const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
        if (
          !Number.isSafeInteger(start) ||
          !Number.isSafeInteger(end) ||
          start >= size ||
          end < start ||
          (!match[1] && !Number(match[2]))
        ) {
          response.writeHead(416, { 'Content-Range': `bytes */${size}`, 'Content-Length': 0 });
          response.end();
          return;
        }
        response.writeHead(206, {
          ...headers,
          'Content-Range': `bytes ${start}-${end}/${size}`,
          'Content-Length': end - start + 1,
        });
        fs.createReadStream(filename, { start, end }).pipe(response);
        return;
      }
    }
    response.writeHead(200, headers);
    if (request.method === 'HEAD') response.end();
    else fs.createReadStream(filename).pipe(response);
  })
  .listen(port, '0.0.0.0', () => console.log(`Nuzzle ready at http://localhost:${port}`));
