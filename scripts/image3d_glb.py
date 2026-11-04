"""Offline structural preflight for user-supplied image-to-3D GLB exports.

This scans GLB chunk headers and its JSON scene without copying the entire
binary texture/geometry payload into memory. Fidelity-first: no arbitrary
mesh polygon or authoring-byte cap. GLB 2.0 itself uses a 32-bit file length.
It does not establish visual likeness, sound rigging or safe GPU memory usage.
"""
import json
import struct
from pathlib import Path


def inspect_glb(path):
    source = Path(path)
    if source.suffix.lower() != ".glb":
        raise ValueError("Supply a local, self-contained .glb file")
    size = source.stat().st_size
    if size < 24 or size > 0xFFFFFFFF:
        raise ValueError("Source size is outside the binary glTF 2.0 specification")

    document = None
    binary_chunks = 0
    with source.open("rb") as stream:
        header = stream.read(12)
        if len(header) != 12:
            raise ValueError("Truncated GLB header")
        magic, version, declared = struct.unpack("<4sII", header)
        if magic != b"glTF" or version != 2 or declared != size:
            raise ValueError("Invalid glTF 2.0 binary header or file length")
        offset = 12
        while offset < size:
            chunk_header = stream.read(8)
            if len(chunk_header) != 8:
                raise ValueError("Truncated GLB chunk header")
            length, kind = struct.unpack("<II", chunk_header)
            offset += 8
            if length % 4 or length > size - offset:
                raise ValueError("Truncated or unaligned GLB chunk")
            if kind == 0x4E4F534A:
                if document is not None or offset != 20:
                    raise ValueError("GLB JSON chunk must appear exactly once, first")
                try:
                    document = json.loads(stream.read(length))
                except (ValueError, UnicodeDecodeError) as exc:
                    raise ValueError("Invalid GLB JSON") from exc
            else:
                stream.seek(length, 1)
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
