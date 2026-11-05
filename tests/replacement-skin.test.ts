import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { petReplacements } from '../lib/pet-replacements';

type Accessor = {
  bufferView?: number;
  byteOffset?: number;
  componentType: number;
  count: number;
  type: string;
  normalized?: boolean;
  sparse?: {
    count: number;
    indices: { bufferView: number; byteOffset?: number; componentType: number };
    values: { bufferView: number; byteOffset?: number };
  };
};
type Primitive = {
  attributes: Record<string, number>;
  targets?: Record<string, number>[];
  extensions?: Record<string, unknown>;
};
type Document = {
  buffers: { byteLength: number; uri?: string }[];
  bufferViews: {
    buffer: number;
    byteOffset?: number;
    byteLength: number;
    byteStride?: number;
    extensions?: Record<string, unknown>;
  }[];
  accessors: Accessor[];
  nodes: { mesh?: number; skin?: number }[];
  meshes: { primitives: Primitive[] }[];
  skins?: { joints: number[]; skeleton?: number; inverseBindMatrices?: number }[];
  animations?: {
    name?: string;
    channels: { sampler: number; target: { node?: number; path: string } }[];
    samplers: { input: number; output: number; interpolation?: string }[];
  }[];
};

function item<T>(list: readonly T[] | undefined, index: number | undefined, label: string): T {
  assert.ok(typeof index === 'number' && Number.isInteger(index), label + ' is not an index');
  assert.ok(list && index >= 0 && index < list.length, label + ' is out of range');
  return list[index];
}

/** Decode actual binary accessors, including quantization, stride and sparse overrides. */
function openGlb(file: string) {
  const bytes = readFileSync(file);
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  let document: Document | undefined;
  let binary: Buffer | undefined;
  for (let offset = 12; offset < bytes.length;) {
    assert.ok(offset + 8 <= bytes.length, 'truncated chunk header');
    const length = bytes.readUInt32LE(offset),
      kind = bytes.readUInt32LE(offset + 4);
    offset += 8;
    assert.ok(length % 4 === 0 && offset + length <= bytes.length, 'invalid chunk bounds');
    if (kind === 0x4e4f534a) document = JSON.parse(bytes.toString('utf8', offset, offset + length));
    if (kind === 0x004e4942) binary = bytes.subarray(offset, offset + length);
    offset += length;
  }
  assert.ok(document, 'missing glTF JSON');
  const doc = document;
  const bufferCache = new Map<number, Buffer>();
  function buffer(index: number): Buffer {
    const cached = bufferCache.get(index);
    if (cached) return cached;
    const definition = item(doc.buffers, index, 'buffer');
    let result: Buffer;
    if (!definition.uri) {
      assert.equal(index, 0, 'only GLB buffer 0 may use the BIN chunk');
      assert.ok(binary, 'missing BIN chunk');
      result = binary;
    } else {
      const match = /^data:([^,]*),(.*)$/s.exec(definition.uri);
      assert.ok(
        match,
        'external binary buffers are not supported by this self-contained asset test',
      );
      result = match[1].endsWith(';base64')
        ? Buffer.from(match[2], 'base64')
        : Buffer.from(
            match[2].replace(/%([a-f\d]{2})/gi, (_, hex) =>
              String.fromCharCode(Number.parseInt(hex, 16)),
            ),
            'latin1',
          );
    }
    assert.ok(result.length >= definition.byteLength, 'buffer is shorter than declared');
    bufferCache.set(index, result);
    return result;
  }
  function view(index: number) {
    const definition = item(doc.bufferViews, index, 'bufferView');
    assert.ok(
      !definition.extensions?.EXT_meshopt_compression,
      'semantic validation requires decoded Meshopt data',
    );
    const contents = buffer(definition.buffer),
      offset = definition.byteOffset ?? 0;
    assert.ok(
      offset >= 0 && offset + definition.byteLength <= contents.length,
      'bufferView is out of bounds',
    );
    return { definition, contents: contents.subarray(offset, offset + definition.byteLength) };
  }
  const componentBytes: Record<number, number> = {
    5120: 1,
    5121: 1,
    5122: 2,
    5123: 2,
    5125: 4,
    5126: 4,
  };
  function number(contents: Buffer, offset: number, component: number, normalized = false): number {
    let value: number;
    switch (component) {
      case 5120:
        value = contents.readInt8(offset);
        break;
      case 5121:
        value = contents.readUInt8(offset);
        break;
      case 5122:
        value = contents.readInt16LE(offset);
        break;
      case 5123:
        value = contents.readUInt16LE(offset);
        break;
      case 5125:
        value = contents.readUInt32LE(offset);
        break;
      case 5126:
        value = contents.readFloatLE(offset);
        break;
      default:
        throw new Error('Unsupported accessor component type ' + component);
    }
    if (!normalized) return value;
    switch (component) {
      case 5120:
        return Math.max(-1, value / 127);
      case 5121:
        return value / 255;
      case 5122:
        return Math.max(-1, value / 32767);
      case 5123:
        return value / 65535;
      default:
        throw new Error('Invalid normalized accessor component type ' + component);
    }
  }
  const cache = new Map<number, { definition: Accessor; width: number; values: Float64Array }>();
  function accessor(index: number) {
    const cached = cache.get(index);
    if (cached) return cached;
    const definition = item(doc.accessors, index, 'accessor');
    assert.ok(Number.isInteger(definition.count) && definition.count > 0, 'invalid accessor count');
    const widths: Record<string, number> = {
      SCALAR: 1,
      VEC2: 2,
      VEC3: 3,
      VEC4: 4,
      MAT2: 4,
      MAT3: 9,
      MAT4: 16,
    };
    const width = widths[definition.type],
      size = componentBytes[definition.componentType];
    assert.ok(
      width && size,
      'unsupported accessor format ' + definition.type + '/' + definition.componentType,
    );
    const columns = definition.type.startsWith('MAT') ? Number(definition.type.at(-1)) : 1;
    const rows = width / columns;
    // Integer matrix columns have glTF's required four-byte padding.
    const columnStride = columns > 1 ? Math.ceil((rows * size) / 4) * 4 : rows * size;
    const elementBytes = columns * columnStride;
    const values = new Float64Array(definition.count * width);
    const readElement = (contents: Buffer, start: number, row: number) => {
      assert.ok(
        start >= 0 && start + elementBytes <= contents.length,
        'accessor data is out of bounds',
      );
      for (let lane = 0; lane < width; lane++) {
        const offset = Math.floor(lane / rows) * columnStride + (lane % rows) * size;
        const value = number(
          contents,
          start + offset,
          definition.componentType,
          definition.normalized,
        );
        assert.ok(Number.isFinite(value), 'accessor contains nonfinite values');
        values[row * width + lane] = value;
      }
    };
    if (definition.bufferView !== undefined) {
      const base = view(definition.bufferView),
        stride = base.definition.byteStride ?? elementBytes;
      assert.ok(stride >= elementBytes && stride % size === 0, 'invalid accessor stride');
      for (let row = 0; row < definition.count; row++)
        readElement(base.contents, (definition.byteOffset ?? 0) + row * stride, row);
    } else assert.ok(definition.sparse, 'accessor has neither a bufferView nor sparse data');
    if (definition.sparse) {
      const sparse = definition.sparse;
      assert.ok(
        Number.isInteger(sparse.count) && sparse.count > 0 && sparse.count <= definition.count,
        'invalid sparse count',
      );
      assert.ok(
        [5121, 5123, 5125].includes(sparse.indices.componentType),
        'unsupported sparse index format',
      );
      const indices = view(sparse.indices.bufferView),
        data = view(sparse.values.bufferView);
      assert.equal(
        indices.definition.byteStride,
        undefined,
        'sparse indices must be tightly packed',
      );
      assert.equal(data.definition.byteStride, undefined, 'sparse values must be tightly packed');
      let previous = -1;
      for (let row = 0; row < sparse.count; row++) {
        const offset =
          (sparse.indices.byteOffset ?? 0) + row * componentBytes[sparse.indices.componentType];
        assert.ok(
          offset + componentBytes[sparse.indices.componentType] <= indices.contents.length,
          'sparse index is out of bounds',
        );
        const index = number(indices.contents, offset, sparse.indices.componentType);
        assert.ok(
          index > previous && index < definition.count,
          'sparse indices must increase within accessor bounds',
        );
        readElement(data.contents, (sparse.values.byteOffset ?? 0) + row * elementBytes, index);
        previous = index;
      }
    }
    const result = { definition, width, values };
    cache.set(index, result);
    return result;
  }
  return { doc, accessor };
}

for (const asset of Object.values(petReplacements)) {
  if (asset.approval === 'missing') continue;
  test(asset.speciesId + ': actual skin influences and animation binary data are valid', () => {
    assert.ok(asset.modelUrl, 'nonmissing asset has no GLB');
    const { doc, accessor } = openGlb('public' + asset.modelUrl);
    let skinnedPrimitives = 0;
    const morphCounts = new Map<number, number>();
    for (const [nodeIndex, node] of doc.nodes.entries()) {
      if (node.mesh === undefined) continue;
      const mesh = item(doc.meshes, node.mesh, 'mesh');
      const skin = node.skin === undefined ? null : item(doc.skins, node.skin, 'skin');
      if (skin) {
        assert.ok(skin.joints.length > 0, 'skin has no joints');
        for (const index of skin.joints) item(doc.nodes, index, 'skin joint node');
        if (skin.skeleton !== undefined) item(doc.nodes, skin.skeleton, 'skeleton root');
        if (skin.inverseBindMatrices !== undefined) {
          const bind = accessor(skin.inverseBindMatrices);
          assert.equal(bind.definition.type, 'MAT4');
          assert.equal(bind.definition.componentType, 5126);
          assert.ok(
            bind.definition.count >= skin.joints.length,
            'not enough inverse bind matrices',
          );
        }
      }
      for (const primitive of mesh.primitives) {
        assert.ok(
          !primitive.extensions?.KHR_draco_mesh_compression,
          'semantic validation requires decoded Draco data',
        );
        const position = accessor(primitive.attributes.POSITION);
        assert.equal(position.definition.type, 'VEC3');
        if (primitive.targets?.length) {
          const previous = morphCounts.get(nodeIndex);
          assert.ok(
            previous === undefined || previous === primitive.targets.length,
            'inconsistent morph target counts',
          );
          morphCounts.set(nodeIndex, primitive.targets.length);
          for (const target of primitive.targets)
            for (const index of Object.values(target)) {
              const delta = accessor(index);
              assert.equal(delta.definition.type, 'VEC3');
              assert.equal(
                delta.definition.count,
                position.definition.count,
                'morph/position count mismatch',
              );
            }
        }
        if (!skin) continue;
        skinnedPrimitives++;
        const sets = Object.keys(primitive.attributes)
          .filter((key) => /^JOINTS_\d+$/.test(key))
          .map((key) => Number(key.slice(7)))
          .sort((a, b) => a - b);
        const weightSets = Object.keys(primitive.attributes)
          .filter((key) => /^WEIGHTS_\d+$/.test(key))
          .map((key) => Number(key.slice(8)))
          .sort((a, b) => a - b);
        assert.ok(sets.length > 0 && sets[0] === 0, 'skinned primitive has no JOINTS_0');
        assert.deepEqual(weightSets, sets, 'joint/weight sets are not paired');
        const sums = new Float64Array(position.definition.count);
        let roundingTolerance = 0;
        for (const set of sets) {
          const joints = accessor(primitive.attributes['JOINTS_' + set]),
            weights = accessor(primitive.attributes['WEIGHTS_' + set]);
          assert.equal(joints.definition.type, 'VEC4');
          assert.equal(weights.definition.type, 'VEC4');
          assert.equal(
            joints.definition.count,
            position.definition.count,
            'joint/position count mismatch',
          );
          assert.equal(
            weights.definition.count,
            position.definition.count,
            'weight/position count mismatch',
          );
          assert.ok(
            [5121, 5123].includes(joints.definition.componentType),
            'joints must be unsigned byte/short',
          );
          assert.ok(!joints.definition.normalized, 'joint indices cannot be normalized');
          assert.ok(
            [5121, 5123, 5126].includes(weights.definition.componentType),
            'unsupported weight component format',
          );
          assert.equal(
            !!weights.definition.normalized,
            weights.definition.componentType !== 5126,
            'integer weights must be normalized; float weights must not be',
          );
          roundingTolerance +=
            weights.definition.componentType === 5121
              ? 2 / 255
              : weights.definition.componentType === 5123
                ? 2 / 65535
                : 0;
          for (let row = 0; row < position.definition.count; row++)
            for (let lane = 0; lane < 4; lane++) {
              const offset = row * 4 + lane,
                joint = joints.values[offset],
                weight = weights.values[offset];
              assert.ok(
                Number.isInteger(joint) && joint >= 0 && joint < skin.joints.length,
                'joint influence outside the skin joint table',
              );
              assert.ok(weight >= 0 && weight <= 1, 'skin weight outside [0,1]');
              sums[row] += weight;
            }
        }
        for (const sum of sums) {
          assert.ok(sum > 0, 'vertex has no bound joint influence');
          assert.ok(
            Math.abs(sum - 1) <= Math.max(0.001, roundingTolerance + 0.000001),
            'skin influences are not approximately normalized: ' + sum,
          );
        }
      }
    }
    if (asset.clips.length)
      assert.ok(
        skinnedPrimitives > 0 || morphCounts.size > 0,
        'animated asset has no skin or morph deformation',
      );
    for (const animation of doc.animations ?? []) {
      assert.ok(animation.channels.length > 0, 'empty animation');
      for (const channel of animation.channels) {
        const node = item(doc.nodes, channel.target.node, 'animation target node');
        const sampler = item(animation.samplers, channel.sampler, 'animation sampler');
        const input = accessor(sampler.input),
          output = accessor(sampler.output);
        assert.equal(input.definition.type, 'SCALAR');
        assert.equal(input.definition.componentType, 5126);
        assert.ok(!input.definition.normalized, 'time accessor cannot be normalized');
        let previous = -Infinity;
        for (const time of input.values) {
          assert.ok(
            time >= 0 && time > previous,
            'animation times must be finite, nonnegative and strictly increasing',
          );
          previous = time;
        }
        const interpolation = sampler.interpolation ?? 'LINEAR';
        assert.ok(
          ['LINEAR', 'STEP', 'CUBICSPLINE'].includes(interpolation),
          'unsupported animation interpolation ' + interpolation,
        );
        const expectedType: Record<string, string> = {
          translation: 'VEC3',
          scale: 'VEC3',
          rotation: 'VEC4',
          weights: 'SCALAR',
        };
        assert.ok(
          expectedType[channel.target.path],
          'unsupported animation target path ' + channel.target.path,
        );
        assert.equal(output.definition.type, expectedType[channel.target.path]);
        assert.equal(output.definition.componentType, 5126, 'animation output must be float');
        const targetCount =
          channel.target.path === 'weights' ? morphCounts.get(channel.target.node!) : 1;
        assert.ok(
          targetCount && (channel.target.path !== 'weights' || node.mesh !== undefined),
          'weight animation has no morph targets',
        );
        assert.equal(
          output.definition.count,
          input.definition.count * targetCount * (interpolation === 'CUBICSPLINE' ? 3 : 1),
          'animation input/output count mismatch',
        );
      }
    }
  });
}
