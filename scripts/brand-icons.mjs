import fs from 'node:fs/promises';
import sharp from 'sharp';
const svg = await fs.readFile('public/icons/icon.svg');
for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  await sharp(svg).resize(size, size).png().toFile(`public/icons/${name}`);
}
// A solid full-bleed field with the complete mark inside the maskable safe zone.
const mark = await sharp(svg).resize(360, 360).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#274b3e' } })
  .composite([{ input: mark, gravity: 'centre' }])
  .png()
  .toFile('public/icons/maskable-512.png');
