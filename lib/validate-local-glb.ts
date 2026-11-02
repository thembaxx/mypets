/**
 * Inspect an on-device GLB before handing its object URL to GLTFLoader.
 * No uploads and no remote dependencies. This is a file-safety check,
 * not an approval of the mesh appearance or animation quality.
 */
export function validateLocalGlb(input: ArrayBuffer): void {
  const bytes = new DataView(input);
  if (bytes.byteLength < 20 || bytes.byteLength > 8 * 1024 * 1024) {
    throw new Error('Choose a GLB smaller than 8 MB.');
  }
  if (bytes.getUint32(0, true) !== 0x46546c67 ||
    bytes.getUint32(4, true) !== 2 || bytes.getUint32(8, true) !== bytes.byteLength) {
    throw new Error('This is not a complete glTF 2.0 binary (.glb).');
  }
  const jsonLength = bytes.getUint32(12, true);
  if (bytes.getUint32(16, true) !== 0x4e4f534a ||
    jsonLength < 2 || jsonLength > bytes.byteLength - 20 ||
    jsonLength % 4 !== 0) {
    throw new Error('Invalid GLB JSON chunk.');
  }
  let doc: {
    asset?: { version?: string };
    buffers?: { uri?: string }[];
    images?: { uri?: string }[];
    extensionsRequired?: string[];
    scenes?: unknown[];
    meshes?: { primitives?: { attributes?: { POSITION?: number } }[] }[];
    accessors?: { count?: number }[];
  };
  try {
    doc = JSON.parse(new TextDecoder().decode(new Uint8Array(input, 20, jsonLength)).trim());
  } catch {
    throw new Error('The GLB scene description is invalid.');
  }
  if (doc.asset?.version !== '2.0' || !Array.isArray(doc.scenes)) {
    throw new Error('The GLB scene does not meet the glTF 2.0 standard.');
  }
  const assets = [...(doc.buffers ?? []), ...(doc.images ?? [])];
  if (assets.some(({ uri }) => uri && !uri.startsWith('data:'))) {
    throw new Error('External model textures or network resources are not allowed.');
  }
  const supported = ['KHR_draco_mesh_compression', 'KHR_texture_basisu',
    'KHR_mesh_quantization', 'EXT_meshopt_compression'];
  if ((doc.extensionsRequired ?? []).some((name) => !supported.includes(name))) {
    throw new Error('The model requires an unsupported GLB extension.');
  }
  const vertices = (doc.meshes ?? []).flatMap((mesh) => mesh.primitives ?? [])
    .reduce((sum, part) => {
      const i = part.attributes?.POSITION;
      return sum + (i === undefined ? 0 : (doc.accessors?.[i]?.count ?? 0));
    }, 0);
  if (vertices > 160000) throw new Error('This model is too detailed for the mobile preview.');
}
