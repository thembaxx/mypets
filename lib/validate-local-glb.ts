/**
 * Inspect an on-device GLB before handing its object URL to GLTFLoader.
 * No uploads and no remote dependencies. This is a file-safety check,
 * not an approval of the mesh appearance or animation quality.
 */
export function validateLocalGlb(input: ArrayBuffer): void {
  const bytes = new DataView(input);
  if (bytes.byteLength < 20) {
    throw new Error('Choose a complete glTF 2.0 binary (.glb).');
  }
  if (
    bytes.getUint32(0, true) !== 0x46546c67 ||
    bytes.getUint32(4, true) !== 2 ||
    bytes.getUint32(8, true) !== bytes.byteLength
  ) {
    throw new Error('This is not a complete glTF 2.0 binary (.glb).');
  }
  const jsonLength = bytes.getUint32(12, true);
  if (
    bytes.getUint32(16, true) !== 0x4e4f534a ||
    jsonLength < 2 ||
    jsonLength > bytes.byteLength - 20 ||
    jsonLength % 4 !== 0
  ) {
    throw new Error('Invalid GLB JSON chunk.');
  }
  let doc: {
    asset?: { version?: string };
    buffers?: { uri?: string; byteLength: number }[];
    bufferViews?: { buffer: number; byteOffset?: number; byteLength: number }[];
    images?: { uri?: string }[];
    extensionsRequired?: string[];
    scenes?: unknown[];
  };
  try {
    doc = JSON.parse(new TextDecoder().decode(new Uint8Array(input, 20, jsonLength)).trim());
  } catch {
    throw new Error('The GLB scene description is invalid.');
  }
  if (doc.asset?.version !== '2.0' || !Array.isArray(doc.scenes)) {
    throw new Error('The GLB scene does not meet the glTF 2.0 standard.');
  }
  let offset = 20 + jsonLength;
  let binaryLength: number | null = null;
  while (offset < bytes.byteLength) {
    if (offset + 8 > bytes.byteLength) throw new Error('Truncated GLB chunk header.');
    const length = bytes.getUint32(offset, true);
    const type = bytes.getUint32(offset + 4, true);
    if (length % 4 !== 0 || offset + 8 + length > bytes.byteLength)
      throw new Error('Truncated or unaligned GLB chunk.');
    if (type === 0x4e4f534a) throw new Error('Multiple GLB JSON chunks.');
    if (type === 0x004e4942) {
      if (binaryLength !== null || offset !== 20 + jsonLength)
        throw new Error('The GLB BIN chunk must follow its JSON chunk once.');
      binaryLength = length;
    }
    offset += 8 + length;
  }
  const assets = [...(doc.buffers ?? []), ...(doc.images ?? [])];
  if (assets.some(({ uri }) => uri && !uri.startsWith('data:'))) {
    throw new Error('External model textures or network resources are not allowed.');
  }
  for (const [index, buffer] of (doc.buffers ?? []).entries()) {
    if (!Number.isSafeInteger(buffer.byteLength) || buffer.byteLength < 0)
      throw new Error('Invalid GLB buffer length.');
    if (!buffer.uri && (index !== 0 || binaryLength === null))
      throw new Error('Embedded GLB buffer is missing its BIN chunk.');
    if (
      !buffer.uri &&
      binaryLength !== null &&
      (buffer.byteLength > binaryLength || binaryLength - buffer.byteLength > 3)
    )
      throw new Error('The GLB buffer length does not match its BIN chunk.');
  }
  for (const view of doc.bufferViews ?? []) {
    const buffer = doc.buffers?.[view.buffer];
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
      throw new Error('A GLB buffer view exceeds its buffer bounds.');
  }
  // GLTFLoader supports these without optional decoder/transcoder setup.
  // Draco, Meshopt and Basis/KTX2 require decoders that this viewer does not install.
  const supported = [
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
  ];
  if ((doc.extensionsRequired ?? []).some((name) => !supported.includes(name))) {
    throw new Error('The model requires an unsupported GLB extension.');
  }
}
