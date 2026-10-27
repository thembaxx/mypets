import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_POSITIONS = 160_000;

export function inspectGlb(bytes, maxBytes = MAX_BYTES) {
  if (bytes.length < 20 || bytes.length > maxBytes) throw new Error('GLB size is invalid or exceeds the 8 MiB asset budget');
  if (bytes.toString('ascii', 0, 4) !== 'glTF') throw new Error('Invalid GLB magic');
  if (bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw new Error('Invalid GLB version or declared length');
  let offset = 12;
  let json;
  let hasBinary = false;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) throw new Error('Truncated GLB chunk header');
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    offset += 8;
    if (length % 4 !== 0 || offset + length > bytes.length) throw new Error('Truncated or unaligned GLB chunk');
    if (type === 0x4e4f534a) {
      if (json) throw new Error('Multiple JSON chunks');
      json = JSON.parse(bytes.toString('utf8', offset, offset + length).trim());
    }
    if (type === 0x004e4942) hasBinary = true;
    offset += length;
  }
  if (!json || json.asset?.version !== '2.0') throw new Error('Missing glTF 2.0 asset metadata');
  if (!Array.isArray(json.nodes) || !Array.isArray(json.scenes)) throw new Error('Missing scene graph');
  for (const item of [...(json.buffers ?? []), ...(json.images ?? [])]) {
    if (item.uri && !item.uri.startsWith('data:')) throw new Error('External asset URI is forbidden; embed textures and buffers');
  }
  if ((json.buffers ?? []).some((buffer) => !buffer.uri) && !hasBinary) throw new Error('Embedded buffer missing BIN chunk');
  const positions = (json.meshes ?? []).flatMap((mesh) => mesh.primitives ?? []).reduce((sum, primitive) => {
    const index = primitive.attributes?.POSITION;
    return sum + (index === undefined ? 0 : (json.accessors?.[index]?.count ?? 0));
  }, 0);
  if (positions > MAX_POSITIONS) throw new Error(`Geometry exceeds ${MAX_POSITIONS} vertex-position budget`);
  if ((json.extensionsRequired ?? []).some((extension) => !['KHR_draco_mesh_compression', 'KHR_texture_basisu', 'EXT_meshopt_compression', 'KHR_mesh_quantization'].includes(extension))) {
    throw new Error('Unsupported mandatory glTF extension');
  }
  return { meshes: json.meshes?.length ?? 0, positions, animations: json.animations?.length ?? 0 };
}

export function inspectDirectory(root, requireAssets = false) {
  const files = [];
  function walk(folder) {
    if (!existsSync(folder)) return;
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const path = join(folder, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Symlink not allowed in 3D assets: ${entry.name}`);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.glb')) files.push(path);
    }
  }
  walk(root);
  if (requireAssets && files.length === 0) throw new Error('Expected production GLB assets were not found');
  for (const path of files) {
    const metrics = inspectGlb(readFileSync(path));
    console.log(`GLB OK ${relative(root, path)} — ${metrics.meshes} meshes, ${metrics.positions} positions, ${metrics.animations} clips`);
  }
  return files.length;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const root = resolve(process.cwd(), process.argv[2] ?? 'public/models');
    const count = inspectDirectory(root, process.argv.includes('--require-assets'));
    console.log(`Checked ${count} GLB asset${count === 1 ? '' : 's'}.`);
  } catch (error) {
    console.error('3D asset validation failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
