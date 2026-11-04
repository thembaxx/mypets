/**
 * Validate an on-device GLB without uploading it anywhere.
 *
 * No artistic polygon or byte budget: high-detail source assets are welcome.
 * This only checks structural integrity and prevents external URI fetches.
 * Parsing a huge model can still exceed an individual device's GPU memory.
 */
export function validateLocalGlb(input: ArrayBuffer): void {
  const view = new DataView(input);
  const length = view.byteLength;
  if (length < 24) throw new Error('This is not a complete glTF 2.0 binary (.glb).');
  if (
    view.getUint32(0, true) !== 0x46546c67 ||
    view.getUint32(4, true) !== 2 ||
    view.getUint32(8, true) !== length
  ) {
    throw new Error('This is not a complete glTF 2.0 binary (.glb).');
  }

  let offset = 12;
  let doc: {
    asset?: { version?: string };
    buffers?: { uri?: string; byteLength?: number }[];
    images?: { uri?: string }[];
    extensionsRequired?: string[];
    nodes?: unknown[];
    scenes?: unknown[];
    meshes?: { primitives?: { attributes?: { POSITION?: number } }[] }[];
    accessors?: { count?: number }[];
  } | null = null;
  let hasBinary = false;
  while (offset < length) {
    if (offset + 8 > length) throw new Error('Truncated GLB chunk header.');
    const chunkLength = view.getUint32(offset, true);
    const kind = view.getUint32(offset + 4, true);
    offset += 8;
    if (chunkLength % 4 !== 0 || chunkLength > length - offset) {
      throw new Error('Truncated or unaligned GLB chunk.');
    }
    if (kind === 0x4e4f534a) {
      if (doc || offset !== 20) throw new Error('Duplicated or misplaced GLB JSON chunk.');
      try {
        doc = JSON.parse(
          new TextDecoder().decode(new Uint8Array(input, offset, chunkLength)).trim(),
        );
      } catch {
        throw new Error('The GLB scene description is invalid.');
      }
    }
    if (kind === 0x004e4942) hasBinary = true;
    offset += chunkLength;
  }

  if (
    !doc ||
    doc.asset?.version !== '2.0' ||
    !Array.isArray(doc.scenes) ||
    !Array.isArray(doc.nodes)
  ) {
    throw new Error('The GLB scene does not meet the glTF 2.0 standard.');
  }
  const assets = [...(doc.buffers ?? []), ...(doc.images ?? [])];
  if (assets.some(({ uri }) => uri && !uri.startsWith('data:'))) {
    throw new Error('External model textures or network resources are not allowed.');
  }
  if ((doc.buffers ?? []).some((buffer) => !buffer.uri && buffer.byteLength && !hasBinary)) {
    throw new Error('The GLB is missing its embedded geometry.');
  }
  const supported = [
    'KHR_draco_mesh_compression',
    'KHR_texture_basisu',
    'KHR_mesh_quantization',
    'EXT_meshopt_compression',
  ];
  if ((doc.extensionsRequired ?? []).some((name) => !supported.includes(name))) {
    throw new Error('The model requires an unsupported GLB extension.');
  }
  for (const mesh of doc.meshes ?? []) {
    for (const part of mesh.primitives ?? []) {
      const index = part.attributes?.POSITION;
      if (index === undefined) continue; // Compressed geometry may omit POSITION.
      if (
        !Number.isSafeInteger(index) ||
        index < 0 ||
        !Number.isSafeInteger(doc.accessors?.[index]?.count) ||
        (doc.accessors?.[index]?.count ?? 0) < 0
      ) {
        throw new Error('The GLB has an invalid mesh POSITION accessor.');
      }
    }
  }
}
