import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export function inspectGlb(bytes) {
  if (bytes.length < 20) throw new Error('GLB is too short for its header and JSON chunk');
  if (bytes.toString('ascii', 0, 4) !== 'glTF') throw new Error('Invalid GLB magic');
  if (bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length)
    throw new Error('Invalid GLB version or declared length');
  let offset = 12;
  let json;
  let binaryLength = null;
  let chunks = 0;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) throw new Error('Truncated GLB chunk header');
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    offset += 8;
    if (length % 4 !== 0 || offset + length > bytes.length)
      throw new Error('Truncated or unaligned GLB chunk');
    if (chunks === 0 && type !== 0x4e4f534a) throw new Error('GLB JSON must be the first chunk');
    if (type === 0x4e4f534a) {
      if (json) throw new Error('Multiple JSON chunks');
      json = JSON.parse(bytes.toString('utf8', offset, offset + length).trim());
    }
    if (type === 0x004e4942) {
      if (binaryLength !== null || chunks !== 1)
        throw new Error('GLB BIN chunk must follow JSON once');
      binaryLength = length;
    }
    offset += length;
    chunks++;
  }
  if (!json || json.asset?.version !== '2.0') throw new Error('Missing glTF 2.0 asset metadata');
  if (!Array.isArray(json.nodes) || !Array.isArray(json.scenes))
    throw new Error('Missing scene graph');
  for (const item of [...(json.buffers ?? []), ...(json.images ?? [])]) {
    if (item.uri && !item.uri.startsWith('data:'))
      throw new Error('External asset URI is forbidden; embed textures and buffers');
  }
  for (const [index, buffer] of (json.buffers ?? []).entries()) {
    if (!Number.isSafeInteger(buffer.byteLength) || buffer.byteLength < 0)
      throw new Error('Invalid GLB buffer length');
    if (!buffer.uri && (index !== 0 || binaryLength === null))
      throw new Error('Embedded buffer missing BIN chunk');
    if (
      !buffer.uri &&
      binaryLength !== null &&
      (buffer.byteLength > binaryLength || binaryLength - buffer.byteLength > 3)
    )
      throw new Error('GLB buffer length does not match BIN chunk');
  }
  for (const view of json.bufferViews ?? []) {
    const buffer = json.buffers?.[view.buffer];
    const start = view.byteOffset ?? 0;
    if (
      !buffer ||
      !Number.isSafeInteger(view.buffer) ||
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(view.byteLength) ||
      start < 0 ||
      view.byteLength < 0 ||
      start + view.byteLength > buffer.byteLength
    )
      throw new Error('GLB buffer view exceeds buffer bounds');
  }
  const positions = (json.meshes ?? [])
    .flatMap((mesh) => mesh.primitives ?? [])
    .reduce((sum, primitive) => {
      const index = primitive.attributes?.POSITION;
      return sum + (index === undefined ? 0 : (json.accessors?.[index]?.count ?? 0));
    }, 0);
  if (
    (json.extensionsRequired ?? []).some(
      (extension) =>
        ![
          'KHR_mesh_quantization',
          'KHR_lights_punctual',
          'KHR_materials_unlit',
          'KHR_texture_transform',
          'KHR_materials_clearcoat',
          'KHR_materials_diffuse_roughness',
          'KHR_materials_dispersion',
          'KHR_materials_ior',
          'KHR_materials_sheen',
          'KHR_materials_specular',
          'KHR_materials_transmission',
          'KHR_materials_iridescence',
          'KHR_materials_anisotropy',
          'KHR_materials_volume',
          'KHR_materials_emissive_strength',
        ].includes(extension),
    )
  ) {
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
      if (entry.isSymbolicLink())
        throw new Error(`Symlink not allowed in 3D assets: ${entry.name}`);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.glb')) files.push(path);
    }
  }
  walk(root);
  if (requireAssets && files.length === 0)
    throw new Error('Expected production GLB assets were not found');
  for (const path of files) {
    const metrics = inspectGlb(readFileSync(path));
    console.log(
      `GLB OK ${relative(root, path)} — ${metrics.meshes} meshes, ${metrics.positions} positions, ${metrics.animations} clips`,
    );
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
