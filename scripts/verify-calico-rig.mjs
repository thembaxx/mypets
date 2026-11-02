import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const filename = process.argv[2];
if (!filename) throw new Error('Pass an actual .glb file from Blender');
const bytes = readFileSync(filename);
assert.equal(bytes.toString('ascii', 0, 4), 'glTF', 'The candidate must be a binary GLB');
assert.equal(bytes.readUInt32LE(4), 2);
assert.equal(bytes.readUInt32LE(8), bytes.length);
assert.equal(bytes.readUInt32LE(16), 0x4e4f534a);
const doc = JSON.parse(
  bytes
    .subarray(20, 20 + bytes.readUInt32LE(12))
    .toString('utf8')
    .trim(),
);
assert.ok(doc.nodes?.length > 12, 'Require articulated node hierarchy');
// Ensure fur microdetail is present in the *actual GLB*, not just in Blender.
assert.ok((doc.images ?? []).length >= 1, 'Missing packed short-fur normal image');
assert.ok((doc.textures ?? []).length >= 1, 'Missing exported fur normal texture');
assert.ok(
  (doc.materials ?? []).filter((m) => m.normalTexture !== undefined).length >= 3,
  'Require shared PBR coat normals on the ivory, amber and chocolate fur materials',
);
assert.ok(
  doc.skins?.some((skin) => skin.joints?.length >= 12),
  'Require actual exported skin and skeleton',
);
const actualNames = (doc.animations ?? []).map((clip) => clip.name || '');
const expected = ['Idle', 'Walk', 'Eat', 'Play', 'Rest', 'Groom', 'Sniff'];
for (const clip of expected)
  assert.ok(
    actualNames.some((name) => name.toLowerCase().includes(clip.toLowerCase())),
    `Rigged model must expose separate authored clip ${clip}; found ${actualNames.join(', ')}`,
  );
const morphs = (doc.meshes ?? []).flatMap((mesh) => mesh.extras?.targetNames ?? []);
// Blender glTF exports the OBJECT name to a node and the datablock name to
// a mesh. Never infer one from the other: the saved .blend topology audit
// already establishes that each limb consists of one connected mesh.
function meshInstances() {
  return (doc.nodes ?? [])
    .filter((node) => Number.isInteger(node.mesh))
    .map((node) => ({
      node,
      mesh: doc.meshes?.[node.mesh],
      name: node.name ?? '',
    }))
    .filter((entry) => entry.mesh);
}
const instances = meshInstances();
for (const label of ['Front_L', 'Front_R', 'Rear_L', 'Rear_R']) {
  const limb = instances.find(({ name }) => name === label + ' lower paw');
  assert.ok(
    limb,
    `Missing connected limb node ${label}; exported mesh nodes: ${instances.map(({ name }) => name).join(', ')}`,
  );
  assert.ok(
    (limb.mesh.primitives ?? []).some(
      (part) => part.attributes?.JOINTS_0 !== undefined && part.attributes?.WEIGHTS_0 !== undefined,
    ),
    `Limb ${label} node must reference actual skin-weighted geometry`,
  );
  assert.ok(
    !instances.some(({ name }) => name === label + ' shoulder'),
    `Separated shoulder mesh returned for ${label}`,
  );
}
assert.ok(
  instances.filter(({ name }) => name.startsWith('Fur ')).length >= 5,
  'Review candidate must include batched sculpted silhouette fur nodes',
);
for (const key of [
  'Blink_L',
  'Blink_R',
  'Eye_Wide',
  'Jaw_Open',
  'Lick',
  'Smile',
  'Cheek_Puff',
  'Sniff',
])
  assert.ok(
    morphs.includes(key),
    `Expected animated facial geometry ${key}; available: ${morphs.join(', ')}`,
  );
assert.ok(
  (doc.meshes ?? []).some((mesh) =>
    (mesh.primitives ?? []).some(
      (part) => part.attributes?.JOINTS_0 !== undefined && part.attributes?.WEIGHTS_0 !== undefined,
    ),
  ),
  'Require skinned geometry, not static images or baked sprite planes',
);
// Verify the actual binary skin weights, not just the presence of joints.
// At least hundreds of vertices must blend two real bones with nontrivial
// weights; a collection of individually rigid moving spheres does not qualify.
const jsonLength = bytes.readUInt32LE(12);
let chunk = 20 + jsonLength;
let binaryStart = -1;
while (chunk + 8 <= bytes.length) {
  const byteLength = bytes.readUInt32LE(chunk);
  const kind = bytes.readUInt32LE(chunk + 4);
  if (kind === 0x004e4942) {
    binaryStart = chunk + 8;
    break;
  }
  chunk += 8 + byteLength;
}
assert.ok(binaryStart >= 0, 'GLB should embed its actual vertex buffers');

// A material can reference a PNG that is all black: inspect the encoded pixels.
function auditFurNormalPixels() {
  const image = (doc.images ?? []).find((item) =>
    item.name?.includes('calico-short-fur-normal'),
  );
  assert.ok(image?.bufferView !== undefined, 'Missing embedded fur normal image');
  const view = doc.bufferViews[image.bufferView];
  assert.ok(view.byteLength >= 2500, 'Blank or tiny fur normal PNG');
  const png = bytes.subarray(binaryStart + (view.byteOffset ?? 0),
    binaryStart + (view.byteOffset ?? 0) + view.byteLength);
  assert.equal(png.subarray(1, 4).toString('ascii'), 'PNG');
  const idat = [];
  let width = 0, height = 0, channels = 0, offset = 8;
  while (offset + 12 <= png.length) {
    const length = png.readUInt32BE(offset);
    const tag = png.toString('ascii', offset + 4, offset + 8);
    const payload = png.subarray(offset + 8, offset + 8 + length);
    if (tag === 'IHDR') {
      width = payload.readUInt32BE(0);
      height = payload.readUInt32BE(4);
      assert.equal(payload[8], 8);
      channels = payload[9] === 6 ? 4 : payload[9] === 2 ? 3 : 0;
    }
    if (tag === 'IDAT') idat.push(payload);
    offset += length + 12;
    if (tag === 'IEND') break;
  }
  assert.ok(width >= 64 && height >= 64 && channels >= 3 && idat.length);
  const pixels = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const values = Buffer.alloc(stride * height);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = pixels[pos++];
    for (let x = 0; x < stride; x++) {
      const value = pixels[pos++];
      const left = x >= channels ? values[y*stride + x-channels] : 0;
      const up = y ? values[(y-1)*stride + x] : 0;
      const upLeft = y && x >= channels ? values[(y-1)*stride + x-channels] : 0;
      let pred = 0;
      if (filter === 1) pred = left;
      else if (filter === 2) pred = up;
      else if (filter === 3) pred = (left+up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const a = Math.abs(p-left), b = Math.abs(p-up), c = Math.abs(p-upLeft);
        pred = a <= b && a <= c ? left : b <= c ? up : upLeft;
      } else assert.equal(filter, 0, 'Unsupported PNG filter');
      values[y*stride+x] = (value + pred) & 255;
    }
  }
  let r0=255,r1=0,g0=255,g1=0,b0=255;
  for(let i=0;i<values.length;i+=channels){
    r0=Math.min(r0,values[i]);r1=Math.max(r1,values[i]);
    g0=Math.min(g0,values[i+1]);g1=Math.max(g1,values[i+1]);
    b0=Math.min(b0,values[i+2]);
  }
  assert.ok(r1-r0>=10 && g1-g0>=10 && b0>=210,
    'Blank fur normal map: red '+r0+'-'+r1+' green '+g0+'-'+g1+' blue min '+b0);
  return { width, height, redSpan:r1-r0, greenSpan:g1-g0 };
}
const furPixelAudit = auditFurNormalPixels();
// Test the *exported binary morph deltas*. Requiring named targets alone used
// to accept Eye_Wide/Blink targets that translated pupils several metres
// because the authoring shape keys scaled absolute world positions.
let checkedFacialTargets = 0;
for (const mesh of doc.meshes ?? []) {
  const targetNames = mesh.extras?.targetNames ?? [];
  for (const part of mesh.primitives ?? []) {
    for (const [index, target] of (part.targets ?? []).entries()) {
      const label = targetNames[index];
      if (!label || target.POSITION === undefined) continue;
      const accessor = doc.accessors?.[target.POSITION];
      const view = doc.bufferViews?.[accessor?.bufferView];
      assert.ok(accessor && view, `Morph target ${label} requires a binary accessor`);
      assert.equal(accessor.type, 'VEC3', `Morph target ${label} must export 3D offsets`);
      assert.equal(
        accessor.componentType,
        5126,
        `Morph target ${label} requires float coordinates`,
      );
      const stride = view.byteStride ?? 12;
      const start = binaryStart + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
      for (let n = 0; n < accessor.count; n++) {
        const position = start + n * stride;
        const delta = Math.hypot(
          bytes.readFloatLE(position),
          bytes.readFloatLE(position + 4),
          bytes.readFloatLE(position + 8),
        );
        assert.ok(
          Number.isFinite(delta) && delta <= 0.21,
          `Morph ${label} has an escaped vertex offset ${delta.toFixed(3)}m on ${mesh.name}`,
        );
      }
      checkedFacialTargets++;
    }
  }
}
assert.ok(checkedFacialTargets >= 8, 'Validate every exported facial expression delta');
let blendedVertices = 0;
let maxInfluenceCount = 0;
for (const mesh of doc.meshes ?? []) {
  for (const part of mesh.primitives ?? []) {
    const index = part.attributes?.WEIGHTS_0;
    if (index === undefined) continue;
    const accessor = doc.accessors?.[index];
    const view = doc.bufferViews?.[accessor?.bufferView];
    assert.ok(accessor && view, 'Mesh skin weights require an embedded bufferView');
    assert.equal(accessor.type, 'VEC4');
    const componentBytes =
      accessor.componentType === 5126
        ? 4
        : accessor.componentType === 5123
          ? 2
          : accessor.componentType === 5121
            ? 1
            : 0;
    assert.ok(componentBytes > 0, 'Unsupported skin weight component format');
    const stride = view.byteStride ?? componentBytes * 4;
    const start = binaryStart + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    for (let n = 0; n < accessor.count; n++) {
      let active = 0;
      for (let lane = 0; lane < 4; lane++) {
        const offset = start + n * stride + lane * componentBytes;
        let weight =
          accessor.componentType === 5126
            ? bytes.readFloatLE(offset)
            : accessor.componentType === 5123
              ? bytes.readUInt16LE(offset) / 65535
              : bytes.readUInt8(offset) / 255;
        if (weight > 0.08) active++;
      }
      if (active > 1) blendedVertices++;
      maxInfluenceCount = Math.max(maxInfluenceCount, active);
    }
  }
}
assert.ok(
  blendedVertices >= 160,
  `Need real multi-bone deforming fur surface; observed ${blendedVertices} blended vertices`,
);

assert.ok(bytes.length <= 8 * 1024 * 1024);
console.log(
  JSON.stringify(
    {
      asset: filename,
      bytes: bytes.length,
      skins: doc.skins.length,
      animations: actualNames,
      morphs,
      meshes: doc.meshes.length,
      blendedVertices,
      maxInfluenceCount,
      checkedFacialTargets,
      furPixelAudit,
    },
    null,
    2,
  ),
);
