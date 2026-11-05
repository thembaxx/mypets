// Diagnostic ONLY: alpha-silhouette comparison against the user's single-angle
// reference image. IoU cannot prove depth, topology, animation or facial fidelity.
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const DIM = 512;
async function silhouette(path) {
  const { data, info } = await sharp(path)
    .resize(DIM, DIM, { fit: 'contain', background: '#00000000' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels !== 4) throw new Error('Expected RGBA input');
  const pixels = new Uint8Array(DIM * DIM);
  let count = 0;
  for (let i = 0; i < pixels.length; i++) {
    const idx = i * 4;
    // A dark opaque background is NOT a transparent silhouette.
    const visible = data[idx + 3] >= 128;
    if (visible) {
      pixels[i] = 1;
      count++;
    }
  }
  if (count < 500) throw new Error('No usable alpha silhouette in ' + path);
  if (count > pixels.length * 0.9)
    throw new Error('Image appears opaque. Render the bunny with transparent film: ' + path);
  return pixels;
}

export async function auditReferenceBunny(referencePath, renderPath, outputPath) {
  const [a, b] = await Promise.all([silhouette(referencePath), silhouette(renderPath)]);
  const overlay = Buffer.alloc(DIM * DIM * 4);
  let intersection = 0;
  let union = 0;
  for (let i = 0; i < a.length; i++) {
    const aa = a[i] === 1;
    const bb = b[i] === 1;
    if (aa && bb) intersection++;
    if (aa || bb) union++;
    if (!aa && !bb) continue;
    const j = i * 4;
    // Shared geometry: ivory; reference-only: coral; render-only: blue.
    const rgb = aa && bb ? [236, 236, 220] : aa ? [245, 114, 110] : [67, 151, 228];
    overlay[j] = rgb[0];
    overlay[j + 1] = rgb[1];
    overlay[j + 2] = rgb[2];
    overlay[j + 3] = 255;
  }
  await mkdir(dirname(outputPath), { recursive: true });
  await sharp(overlay, { raw: { width: DIM, height: DIM, channels: 4 } })
    .png()
    .toFile(outputPath);
  return {
    alignment: 'centred contain resize, no camera calibration',
    silhouetteIoU: Number((intersection / union).toFixed(4)),
    referenceOnlyPixels: a.reduce((n, x, i) => n + (x && !b[i] ? 1 : 0), 0),
    renderOnlyPixels: b.reduce((n, x, i) => n + (x && !a[i] ? 1 : 0), 0),
    overlay: outputPath,
    disclaimer: 'A diagnostic, never an automatic visual approval',
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [reference, render, output] = process.argv.slice(2);
  if (!reference || !render || !output) {
    console.error(
      'Usage: node scripts/audit-reference-bunny.mjs original.png review.png overlay.png',
    );
    process.exitCode = 2;
  } else {
    auditReferenceBunny(reference, render, output)
      .then((report) => console.log(JSON.stringify(report, null, 2)))
      .catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
      });
  }
}
