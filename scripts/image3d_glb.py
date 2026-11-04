"""Pure-Python, offline preflight for untrusted image-to-3D GLB exports.

Rejects external resource URLs, oversized or malformed buffers and unreasonable
vertex counts before Blender imports a mesh. This is NOT a mesh/rig-quality gate.
"""
import json
import struct
from pathlib import Path

MAX_SOURCE_BYTES = 64 * 1024 * 1024
MAX_SOURCE_VERTICES = 2_000_000


def inspect_glb(path):
    source = Path(path)
    if source.suffix.lower() != ".glb":
        raise ValueError("Supply a local, self-contained .glb file")
    size = source.stat().st_size
    if size < 24 or size > MAX_SOURCE_BYTES:
        raise ValueError("Source GLB must be between 24 bytes and 64 MiB")
    data = source.read_bytes()
    magic, version, declared = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF" or version != 2 or declared != len(data):
        raise ValueError("Invalid glTF 2.0 binary header or file length")
    offset = 12
    document = None
    binary_chunks = 0
    while offset < len(data):
        if offset + 8 > len(data):
            raise ValueError("Truncated GLB chunk header")
        length, kind = struct.unpack_from("<II", data, offset)
        offset += 8
        if length % 4 or offset + length > len(data):
            raise ValueError("Truncated or unaligned GLB chunk")
        if kind == 0x4E4F534A:
            if document is not None or offset != 20:
                raise ValueError("GLB JSON chunk must appear exactly once, first")
            try:
                document = json.loads(data[offset:offset + length])
            except (ValueError, UnicodeDecodeError) as exc:
                raise ValueError("Invalid GLB JSON") from exc
        if kind == 0x004E4942:
            binary_chunks += 1
        offset += length
    if not isinstance(document, dict) or document.get("asset", {}).get("version") != "2.0":
        raise ValueError("Missing glTF 2.0 JSON scene")
    if binary_chunks != 1:
        raise ValueError("Expected one embedded GLB binary chunk")
    if not document.get("scenes") or not document.get("nodes") or not document.get("meshes"):
        raise ValueError("Source GLB has no usable scene and mesh")
    for item in [*document.get("buffers", []), *document.get("images", [])]:
        uri = item.get("uri")
        if uri and not uri.startswith("data:"):
            raise ValueError("Source GLB contains external resources; embed them before import")
    accessors = document.get("accessors", [])
    vertex_count = 0
    for mesh in document["meshes"]:
        for primitive in mesh.get("primitives", []):
            index = primitive.get("attributes", {}).get("POSITION")
            if not isinstance(index, int) or index < 0 or index >= len(accessors):
                raise ValueError("Mesh primitive has invalid POSITION accessor")
            count = accessors[index].get("count", -1)
            if not isinstance(count, int) or count < 3:
                raise ValueError("Mesh has an invalid POSITION count")
            vertex_count += count
    if vertex_count > MAX_SOURCE_VERTICES:
        raise ValueError("Mesh exceeds the 2-million-vertex authoring safety limit")
    if vertex_count == 0:
        raise ValueError("No mesh vertices found")
    return {
        "bytes": size,
        "meshes": len(document["meshes"]),
        "vertices": vertex_count,
        "skins": len(document.get("skins", [])),
        "animations": [item.get("name", "(unnamed)") for item in document.get("animations", [])],
        "morph_targets": sum(len(primitive.get("targets", []))
                             for mesh in document["meshes"]
                             for primitive in mesh.get("primitives", [])),
    }
