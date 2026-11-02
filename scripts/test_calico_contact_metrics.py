"""Pure contact-drift report invariants; Blender remains source of real geometry."""
import unittest
from calico_contact_metrics import stance_slip_summary


def sample(frame, planted, x, y):
    return {"frame": frame, "paws": {"Front_L": {
        "stance": planted, "contact_xy": (x, y)
    }}}


class ContactSlipTest(unittest.TestCase):
    def test_counts_only_consecutive_stance_pairs(self):
        frames = [sample(1, True, 0.0, 0.0),
                  sample(4, True, 0.03, 0.04),
                  sample(7, False, 0.9, 0.9),
                  sample(10, True, 0.7, 0.7),
                  sample(13, True, 0.7, 0.72)]
        row = stance_slip_summary(frames, ("Front_L",))["Front_L"]
        self.assertEqual(row["paired_stance_samples"], 2)
        self.assertEqual(row["max_step_m"], 0.05)
        self.assertEqual(row["sampled_stance_path_m"], 0.07)

    def test_rejects_missing_support_pairs(self):
        with self.assertRaises(ValueError):
            stance_slip_summary([sample(1, True, 0, 0),
                                 sample(4, False, 0, 0)], ("Front_L",))

    def test_rejects_nonfinite_world_coordinates(self):
        with self.assertRaises(ValueError):
            stance_slip_summary([sample(1, True, float("nan"), 0),
                                 sample(4, True, 0.02, 0)], ("Front_L",))


if __name__ == "__main__":
    unittest.main()
