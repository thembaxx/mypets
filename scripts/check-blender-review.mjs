import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const stems = { paw: 'mypets-paw-blender-candidate', dish: 'mise-plated-blender-candidate' };
function check(value, message) { if (!value) throw new Error(message); }
export function verifyReviewPack(dir, preset) {
  const stem = stems[preset]; check(stem, 'Unsupported preset');
  const name = suffix => join(resolve(dir), stem + suffix);
  check(statSync(name('.blend')).size > 128, 'Missing editable Blender source');
  const bytes = readFileSync(name('.glb'));
  check(bytes.length >= 28 && bytes.length <= 8388608, 'GLB outside asset budget');
  check(bytes.toString('ascii', 0, 4) === 'glTF' && bytes.readUInt32LE(4) === 2 && bytes.readUInt32LE(8) === bytes.length, 'Invalid GLB header');
  const jsonLen = bytes.readUInt32LE(12), at = 20 + jsonLen;
  check(jsonLen % 4 === 0 && jsonLen < 1048576 && bytes.readUInt32LE(16) === 0x4e4f534a, 'Invalid JSON chunk');
  check(at + 8 <= bytes.length && bytes.readUInt32LE(at + 4) === 0x004e4942 &&
    at + 8 + bytes.readUInt32LE(at) === bytes.length, 'Invalid embedded binary');
  const json = JSON.parse(bytes.toString('utf8', 20, at).trim());
  check(json.asset?.version === '2.0' && json.buffers?.length === 1 && !json.buffers[0].uri, 'Missing embedded glTF');
  check(!json.extensionsRequired?.length && !json.images?.length && !json.textures?.length, 'Unsupported viewer extensions or textures');
  check(json.meshes?.length && json.nodes?.length && json.scenes?.length && json.materials?.length, 'Empty scene');
  let count = 0, vertices = 0;
  for (const mesh of json.meshes) for (const part of mesh.primitives || []) {
    const pos = json.accessors?.[part.attributes?.POSITION];
    const normal = json.accessors?.[part.attributes?.NORMAL];
    check((part.mode ?? 4) === 4 && pos?.type === 'VEC3' && pos.componentType === 5126 &&
      pos.count > 0 && pos.min?.length === 3 && pos.max?.length === 3 &&
      [...pos.min, ...pos.max].every(Number.isFinite), 'Unsupported mesh positions');
    check(normal?.type === 'VEC3' && normal.componentType === 5126 && normal.count === pos.count, 'Normals required');
    check(json.materials[part.material]?.pbrMetallicRoughness?.baseColorFactor?.length === 4, 'PBR colour missing');
    vertices += pos.count; count++;
  }
  check(vertices > 0 && vertices <= 160000, 'Exceeded vertex budget');
  check(json.animations?.length, 'No exported animation');
  let channels = 0;
  for (const clip of json.animations) for (const channel of clip.channels || []) {
    const sampler = clip.samplers?.[channel.sampler];
    const input = json.accessors?.[sampler?.input];
    const output = json.accessors?.[sampler?.output];
    check(['translation','rotation','scale'].includes(channel.target?.path) &&
      json.nodes[channel.target.node] && (sampler?.interpolation || 'LINEAR') === 'LINEAR',
      'Unsupported animation channel');
    check(input?.type === 'SCALAR' && input.componentType === 5126 && input.count >= 2 &&
      output?.type === (channel.target.path === 'rotation' ? 'VEC4' : 'VEC3') &&
      output.componentType === 5126 && output.count === input.count, 'Invalid float keyframe accessors');
    channels++;
  }
  check(channels > 0, 'No compatible keyframes');
  const receipt = JSON.parse(readFileSync(name('.json'), 'utf8'));
  check(receipt.project === preset && receipt.source === stem + '.blend' &&
    receipt.candidate === stem + '.glb' && receipt.generator === 'Blender bpy' &&
    receipt.review_status === 'UNAPPROVED' && typeof receipt.blender_version === 'string', 'Provenance mismatch');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  check(sha256 === receipt.sha256, 'SHA-256 checksum mismatch');
  return { preset, meshes: count, vertices, clips: json.animations.length, channels, sha256 };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 4) throw Error('Usage: node scripts/check-blender-review.mjs paw|dish OUTPUT_DIR');
    console.log(JSON.stringify(verifyReviewPack(process.argv[3], process.argv[2]), null, 2));
  } catch (error) {
    console.error('Blender review validation failed: ' + error.message);
    process.exitCode = 1;
  }
}
