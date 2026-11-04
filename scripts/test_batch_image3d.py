"""Tests the 17-animal offline batch pipeline without requiring Blender."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


def load_batch():
    path = Path(__file__).resolve().parent / "batch-image3d-blender.py"
    spec = importlib.util.spec_from_file_location("image3d_batch", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class Image3DBatchTests(unittest.TestCase):
    def test_missing_meshes_are_reported_not_approved(self):
        batch = load_batch()
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            originals = root / "assets" / "animal-originals"
            originals.mkdir(parents=True)
            (originals / "cat.jpg").write_bytes(b"original")
            (originals / "dog.jpg").write_bytes(b"original")
            input_dir = root / "downloads"
            input_dir.mkdir()
            report = batch.run_batch(root, input_dir, root / "review")
            self.assertEqual(report["expected_illustration_count"], 2)
            self.assertEqual(report["processed_count"], 2)
            self.assertEqual(report["ready_count"], 0)
            self.assertEqual(
                [item["status"] for item in report["items"]],
                ["MISSING_GENERATED_GLB", "MISSING_GENERATED_GLB"])
            self.assertEqual(
                json.loads((root / "review" / "image3d-review-manifest.json")
                           .read_text())["status"],
                "UNAPPROVED_ASSETS_ONLY")

    def test_unknown_species_is_rejected(self):
        batch = load_batch()
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            originals = root / "assets" / "animal-originals"
            originals.mkdir(parents=True)
            (originals / "cat.jpg").write_bytes(b"original")
            with self.assertRaisesRegex(ValueError, "Unknown species"):
                batch.run_batch(root, root, root / "review", species="horse")


if __name__ == "__main__":
    unittest.main()
