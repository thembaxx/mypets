"""Pure-Python invariants for the calico's bounded organic sculpt."""
import math
import unittest

from calico_feline_sculpt import skull_position, toe_position, torso_position


class CalicoSculptTest(unittest.TestCase):
    def test_shoulder_narrows_without_shrinking_haunch(self):
        x = .46
        shoulders = torso_position(x, .53, 1.33)
        rump = torso_position(x, -.88, 1.33)
        self.assertLess(shoulders[0], x * .94)
        self.assertGreater(rump[0], x * 1.04)
        self.assertTrue(all(math.isfinite(v) for v in shoulders + rump))

    def test_cranial_brow_stays_above_bounded_face(self):
        jaw = skull_position(.35, 1.05, 1.32)
        brow = skull_position(.35, .68, 1.94)
        self.assertLess(jaw[0], .35 * .95)
        self.assertAlmostEqual(brow[0], .35, places=6)
        self.assertGreaterEqual(brow[2], 1.94)
        self.assertLess(brow[2] - 1.94, .01)

    def test_face_bridge_cheeks_and_eyeline(self):
        bridge = skull_position(.045, 1., 1.69)
        cheek = skull_position(.33, .94, 1.56)
        eye = skull_position(.29, 1., 1.75)
        self.assertGreater(bridge[1], 1.01)
        self.assertGreater(cheek[1], .945)
        self.assertAlmostEqual(eye[1], 1., places=6)

    def test_toe_shape_preserves_ground_and_weight_coordinate(self):
        x, y, z = .47, .63, .18
        toe = toe_position(x, y, z, .46, .33, 1.02)
        self.assertAlmostEqual(toe[0], x)
        self.assertAlmostEqual(toe[2], z)
        self.assertLess(abs(toe[1] - y), .013)
        self.assertNotAlmostEqual(toe[1], y)

    def test_sole_and_ankle_are_not_repositioned(self):
        sole = toe_position(.46, .51, .06, .46, .33, 1.02)
        ankle = toe_position(.46, .51, .55, .46, .33, 1.02)
        self.assertEqual(sole, (.46, .51, .06))
        self.assertEqual(ankle, (.46, .51, .55))


if __name__ == "__main__":
    unittest.main()
