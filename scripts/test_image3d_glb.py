"""Tests for the offline image-to-3D intake safety boundary; no Blender required."""
import json
import struct
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from image3d_glb import inspect_glb


def sample_glb(**updates):
    document = {
        "asset": {"version": "2.0"},
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0}],
        "meshes": [{"primitives": [{"attributes": {"POSITION": 0}}]}],
        "accessors": [{"count": 4}],
        "buffers": [{"byteLength": 4}],
    }
    document.update(updates)
    packed = json.dumps(document, separators=(",", ":")).encode("utf-8")
    packed += b" " * ((-len(packed)) % 4)
    binary = b"\0" * 4
    total = 12 + 8 + len(packed) + 8 + len(binary)
    return (struct.pack("<4sII", b"glTF", 2, total) +
            struct.pack("<II", len(packed), 0x4E4F534A) + packed +
            struct.pack("<II", len(binary), 0x004E4942) + binary)


class Image3DPreflightTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / "animal.glb"

    def tearDown(self):
        self.tmp.cleanup()

    def check(self, binary):
        self.path.write_bytes(binary)
        return inspect_glb(self.path)

    def test_valid_static_mesh_is_not_misreported_as_animated(self):
        info = self.check(sample_glb())
        self.assertEqual(info["vertices"], 4)
        self.assertEqual(info["skins"], 0)
        self.assertEqual(info["animations"], [])

    def test_skin_and_clip_names_alone_do_not_prove_animation(self):
        info = self.check(sample_glb(skins=[{"joints": [0]}],
                                     animations=[{"name": "Walk"}]))
        self.assertEqual(info["skins"], 1)
        self.assertEqual(info["animations"], ["Walk"])
        self.assertFalse(info["rigged_and_animated"])
        self.assertEqual(info["weighted_mesh_nodes"], 0)
        self.assertEqual(info["animation_channel_count"], 0)

    def test_weighted_mesh_and_real_animation_channels_count_as_rigged(self):
        mesh = [{"primitives": [{"attributes": {
            "POSITION": 0, "JOINTS_0": 1, "WEIGHTS_0": 2}}]}]
        nodes = [{"mesh": 0, "skin": 0}]
        animations = [{"name": "Walk", "channels": [
            {"target": {"node": 0, "path": "rotation"}}]}]
        info = self.check(sample_glb(meshes=mesh, nodes=nodes,
                                     skins=[{"joints": [0]}],
                                     animations=animations))
        self.assertEqual(info["weighted_mesh_nodes"], 1)
        self.assertEqual(info["animation_channel_count"], 1)
        self.assertTrue(info["rigged_and_animated"])

    def test_rejects_external_urls(self):
        with self.assertRaisesRegex(ValueError, "external resources"):
            self.check(sample_glb(images=[{"uri": "https://example.org/pet.png"}]))

    def test_accepts_high_detail_source_meshes(self):
        info = self.check(sample_glb(accessors=[{"count": 2_000_001}]))
        self.assertEqual(info["vertices"], 2_000_001)

    def test_rejects_truncated_binary(self):
        with self.assertRaisesRegex(ValueError, "header or file length"):
            self.check(sample_glb()[:-1])

    def test_rejects_unexpected_extension(self):
        self.path = Path(self.tmp.name) / "animal.obj"
        with self.assertRaisesRegex(ValueError, "self-contained"):
            self.check(sample_glb())


if __name__ == "__main__":
    unittest.main()
