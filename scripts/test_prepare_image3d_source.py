"""Offline regression tests for literal original-image extraction."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

import numpy as np
from PIL import Image

source = Path(__file__).with_name("prepare-image3d-source.py")
module_spec = importlib.util.spec_from_file_location("image3d_prep", source)
prep = importlib.util.module_from_spec(module_spec)
module_spec.loader.exec_module(prep)


class SourceExtractionTests(unittest.TestCase):
    def _prepare(self, rgb):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        root = Path(directory.name)
        Image.fromarray(rgb).save(root / "cat.jpg", quality=100)
        report = prep.prepare(root / "cat.jpg", root / "cat.png", 512)
        return report, np.asarray(Image.open(root / "cat.png").convert("RGBA"))

    def test_white_background_and_unaltered_character_color(self):
        img = np.full((400, 400, 3), 255, np.uint8)
        img[105:290, 80:310] = (220, 124, 60)
        report, png = self._prepare(img)
        self.assertFalse(report["generated_mesh"])
        self.assertEqual(report["original_size"], [400, 400])
        self.assertEqual(int(png[0, 0, 3]), 0)
        self.assertEqual(int(png[256, 256, 3]), 255)
        self.assertGreater(report["alpha_coverage"], .2)

    def test_checkerboard_jpg_is_not_a_transparent_input(self):
        y, x = np.indices((400, 400))
        tile = np.where((x//15+y//15) % 2 == 0, 224, 244)
        img = np.repeat(tile[:, :, None], 3, axis=2).astype(np.uint8)
        img[105:290, 80:310] = (230, 140, 35)
        report, png = self._prepare(img)
        self.assertFalse(report["generated_mesh"])
        self.assertEqual(int(png[0, 0, 3]), 0)
        self.assertGreater(report["alpha_coverage"], .2)
        self.assertLess(report["alpha_coverage"], .75)


if __name__ == "__main__":
    unittest.main()
