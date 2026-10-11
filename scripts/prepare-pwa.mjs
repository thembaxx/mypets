import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root = path.resolve('out');
function collect(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory() ? collect(path.join(dir, entry.name)) : [path.join(dir, entry.name)],
    );
}
const assets = collect(path.join(root, '_next/static'))
  .filter((file) => /\.(js|css|woff2?)$/.test(file))
  .map((file) => '/' + path.relative(root, file).split(path.sep).join('/'));
const hash = crypto
  .createHash('sha256')
  .update(fs.readFileSync(path.join(root, 'index.html')))
  .digest('hex')
  .slice(0, 12);
const shell = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/animals/dog.jpg',
  '/animals/cat.jpg',
  '/animals/rabbit.jpg',
  ...assets,
];
const worker = fs
  .readFileSync('public/sw.js', 'utf8')
  .replace("const CACHE = 'mypets-shell-v1';", `const CACHE = 'mypets-shell-${hash}';`)
  .replace(/const SHELL = \[[\s\S]*?\];/, `const SHELL = ${JSON.stringify(shell)};`);
if (!worker.includes(hash)) throw new Error('Could not version the service worker.');
fs.writeFileSync(path.join(root, 'sw.js'), worker);
console.log(`PWA shell ${hash}: ${shell.length} local assets ready for offline use.`);
