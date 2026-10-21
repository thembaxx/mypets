#!/usr/bin/env node
// Never execute in CI: generating a Tripo model can incur API credit charges.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const names = new Set([
  'dog', 'cat', 'rabbit', 'chicken', 'fish', 'hamster', 'bird', 'guinea-pig',
  'snake', 'hedgehog', 'ferret', 'salamander', 'iguana', 'gecko', 'angelfish',
  'budgie', 'canary',
]);
const asset = process.argv[2];
if (!names.has(asset) || !process.argv.includes('--confirm-credits')) {
  console.error('Usage: TRIPO_API_KEY=... node scripts/tripo-generate.mjs dog --confirm-credits');
  console.error('Tripo generation can consume paid credits. No request was sent.');
  process.exitCode = 1;
} else if (!process.env.TRIPO_API_KEY) {
  console.error('TRIPO_API_KEY is required. Never expose it as NEXT_PUBLIC_*.');
  process.exitCode = 1;
} else {
  const api = 'https://openapi.tripo3d.ai/v3';
  const source = (process.env.TRIPO_SOURCE_BASE_URL || 'https://mypets-pi.vercel.app').replace(/\/$/, '') + '/animals/' + asset + '.webp';
  const authorization = 'Bearer ' + process.env.TRIPO_API_KEY;
  async function read(url, options) {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error('Tripo HTTP ' + response.status);
    const parsed = await response.json();
    if (parsed.code !== 0) throw new Error(parsed.message || 'Tripo API error ' + parsed.code);
    return parsed.data;
  }
  try {
    console.log('Submitting the public illustration:', source);
    const created = await read(api + '/generation/image-to-model', {
      method: 'POST',
      headers: { Authorization: authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: source,
        model: 'v3.1-20260211',
        texture: true,
        pbr: true,
        texture_quality: 'detailed',
        orientation: 'align_image',
      }),
    });
    if (!created.task_id) throw new Error('Tripo returned no task ID.');
    let finished;
    for (let attempt = 0; attempt < 60; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 4000));
      const task = await read(api + '/tasks/' + encodeURIComponent(created.task_id), {
        headers: { Authorization: authorization },
      });
      if (task.status === 'success') {
        finished = task;
        break;
      }
      if (task.status === 'failed' || task.status === 'cancelled')
        throw new Error('Tripo generation ' + task.status);
    }
    if (!finished?.output?.model_url) throw new Error('No downloadable model within 4 minutes.');
    const dir = join(process.cwd(), 'assets', 'tripo-candidates');
    await mkdir(dir, { recursive: true });
    const model = await fetch(finished.output.model_url);
    if (!model.ok) throw new Error('Could not download model.');
    await writeFile(join(dir, asset + '.glb'), Buffer.from(await model.arrayBuffer()));
    if (finished.output.rendered_image_url) {
      const preview = await fetch(finished.output.rendered_image_url);
      if (preview.ok) await writeFile(join(dir, asset + '-preview.png'), Buffer.from(await preview.arrayBuffer()));
    }
    console.log('Candidate saved in assets/tripo-candidates/' + asset + '.glb');
    console.log('Tripo credits consumed:', finished.credits_consumed ?? 'check your Tripo account');
    console.log('Original artwork stays unchanged; review before approving this model.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
