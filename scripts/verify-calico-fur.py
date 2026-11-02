"""Verify embedded fur normal image PIXELS in the actual Blender GLB.

The original generated PNG was solid black despite valid glTF texture refs.
This uses only Python's standard library and rejects flat/corrupt images.
"""
import json
import struct
import sys
import zlib
from pathlib import Path


def png_variation(png):
    assert png[:8] == bytes((137,80,78,71,13,10,26,10)), "Invalid PNG"
    chunks, offset, width, height, channels = [], 8, 0, 0, 0
    while offset + 12 <= len(png):
        n = struct.unpack_from(">I",png,offset)[0]
        kind = png[offset+4:offset+8]
        payload = png[offset+8:offset+8+n]
        if kind == b"IHDR":
            width,height,bits,mode,_,_,_ = struct.unpack(">IIBBBBB",payload)
            assert bits == 8 and mode in (2,6), "Expected RGB/RGBA PNG"
            channels = 4 if mode == 6 else 3
        if kind == b"IDAT":
            chunks.append(payload)
        offset += n+12
        if kind == b"IEND":
            break
    assert width >= 64 and height >= 64 and chunks, "Missing atlas data"
    data = zlib.decompress(b"".join(chunks))
    stride = width*channels
    assert len(data) == height*(stride+1), "Truncated PNG"
    decoded = bytearray(height*stride)
    cursor = 0
    for row in range(height):
        filter_type = data[cursor]
        cursor += 1
        for col in range(stride):
            val = data[cursor]
            cursor += 1
            left = decoded[row*stride+col-channels] if col>=channels else 0
            up = decoded[(row-1)*stride+col] if row else 0
            diagonal = decoded[(row-1)*stride+col-channels] if row and col>=channels else 0
            if filter_type == 1:
                val += left
            elif filter_type == 2:
                val += up
            elif filter_type == 3:
                val += (left+up)//2
            elif filter_type == 4:
                p = left+up-diagonal
                a,b,c = abs(p-left),abs(p-up),abs(p-diagonal)
                val += left if a<=b and a<=c else up if b<=c else diagonal
            else:
                assert filter_type == 0, "Unsupported PNG scanline filter"
            decoded[row*stride+col] = val&255
    red = decoded[0::channels]
    green = decoded[1::channels]
    blue = decoded[2::channels]
    result = dict(width=width,height=height,red_span=max(red)-min(red),
                  green_span=max(green)-min(green),blue_min=min(blue))
    assert result["red_span"] >= 10 and result["green_span"] >= 10, (
        "BLACK OR FLAT fur normal: "+str(result)
    )
    assert result["blue_min"] >= 210, "Normals face the wrong direction"
    return result


def inspect(filename):
    glb = Path(filename).read_bytes()
    assert glb[:4] == b"glTF" and len(glb) == struct.unpack_from("<I",glb,8)[0]
    json_size = struct.unpack_from("<I",glb,12)[0]
    doc = json.loads(glb[20:20+json_size])
    image = next((im for im in doc.get("images",[])
                  if "calico-short-fur-normal" in im.get("name","")),None)
    assert image and "bufferView" in image, "Fur PNG is missing from GLB"
    chunk_offset = 20+json_size
    bin_start = None
    while chunk_offset+8 <= len(glb):
        n,kind = struct.unpack_from("<II",glb,chunk_offset)
        if kind == 0x004E4942:
            bin_start = chunk_offset+8
            break
        chunk_offset += n+8
    assert bin_start is not None, "GLB buffer missing"
    view = doc["bufferViews"][image["bufferView"]]
    start = bin_start+view.get("byteOffset",0)
    blob = glb[start:start+view["byteLength"]]
    assert len(blob) >= 2500, "Fur PNG is empty"
    return png_variation(blob)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Provide exported calico GLB path")
    print("EXPORTED_FUR_PIXEL_PASS "+json.dumps(inspect(sys.argv[1]),sort_keys=True))
