"""Offline TRELLIS.2 latent checkpoint and original-art provenance tests."""
import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np

SCRIPTS = Path(__file__).parent
sys.path.insert(0, str(SCRIPTS))
spec = importlib.util.spec_from_file_location(
    "try_trellis2_pilot", SCRIPTS / "try-trellis2-pilot.py"
)
trellis = importlib.util.module_from_spec(spec)
spec.loader.exec_module(trellis)


class LatentStateTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.file = Path(self.tmp.name) / "generated-real-state.npz"
        self.original_hash = "a" * 64
        self.source_hash = "b" * 64
        self.realistic_state = {
            "shape_slat_feats": np.array([[0.1, 0.2], [0.3, 0.4]], dtype=np.float32),
            "tex_slat_feats": np.array([[0.7, 0.2], [0.9, 0.1]], dtype=np.float32),
            "coords": np.array([[0, 1, 2, 3], [0, 5, 6, 7]], dtype=np.int32),
            "res": 1024,
        }

    def test_roundtrip_restores_actual_arrays_without_pickle(self):
        result = trellis.persist_latents(
            self.realistic_state, self.file, self.original_hash, self.source_hash
        )
        self.assertEqual(result, trellis.sha256_file(self.file))
        with np.load(self.file, allow_pickle=False) as archive:
            self.assertEqual(set(archive.files), {
                "shape_slat_feats", "tex_slat_feats", "coords",
                "res", "original_sha256", "source_sha256"
            })
        restored = trellis.restore_latents(
            self.file, self.original_hash, self.source_hash
        )
        self.assertEqual(restored["res"], 1024)
        for key in ("shape_slat_feats", "tex_slat_feats", "coords"):
            np.testing.assert_array_equal(restored[key], self.realistic_state[key])

    def test_refuse_substituted_original_or_preprocessed_input(self):
        trellis.persist_latents(
            self.realistic_state, self.file, self.original_hash, self.source_hash
        )
        with self.assertRaisesRegex(ValueError, "original JPG hash differs"):
            trellis.restore_latents(self.file, "0"*64, self.source_hash)
        with self.assertRaisesRegex(ValueError, "input PNG hash differs"):
            trellis.restore_latents(self.file, self.original_hash, "0"*64)

    def test_refuse_missing_or_nonfinite_generated_arrays(self):
        invalid = self.realistic_state.copy()
        del invalid["tex_slat_feats"]
        with self.assertRaisesRegex(ValueError, "restorable"):
            trellis.persist_latents(
                invalid, self.file, self.original_hash, self.source_hash
            )
        invalid = self.realistic_state.copy()
        invalid["shape_slat_feats"] = np.array([np.inf])
        with self.assertRaisesRegex(ValueError, "Non-finite"):
            trellis.persist_latents(
                invalid, self.file, self.original_hash, self.source_hash
            )


if __name__ == "__main__":
    unittest.main()
