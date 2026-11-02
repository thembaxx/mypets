"""Reference-inspired bounce and facial placement should be deterministic."""
import math
import unittest
from species_playful_style import HEROES, PALETTE, celebration_height, blush_position


class PlayfulStyleTests(unittest.TestCase):
    def test_reference_species_have_both_cheeks_and_safe_palette(self):
        self.assertEqual(HEROES, {"dog", "rabbit", "fish", "angelfish"})
        for species in HEROES:
            for value in PALETTE[species].values():
                self.assertEqual(len(value), 3)
                self.assertTrue(all(0 <= channel <= 1 for channel in value))

    def test_play_loop_seam_and_actual_airborne_apex(self):
        for species, kind in (
            ("dog", "quadruped"), ("rabbit", "quadruped"),
            ("fish", "fish"), ("angelfish", "fish"),
            ("chicken", "bird"), ("gecko", "reptile")
        ):
            self.assertAlmostEqual(celebration_height(species, kind, 0), 0, places=9)
            self.assertAlmostEqual(celebration_height(species, kind, 1), 0, places=9)
            self.assertGreater(celebration_height(species, kind, .25), .08)
            self.assertTrue(all(0 <= celebration_height(species, kind, n/100) <= .31
                                for n in range(101)))
        self.assertGreater(celebration_height("rabbit", "quadruped", .25),
                           celebration_height("dog", "quadruped", .25))
        for bad in (-.1, 1.1, float("nan"), float("inf")):
            with self.assertRaises(ValueError):
                celebration_height("dog", "quadruped", bad)

    def test_blush_is_symmetric_but_visibly_forward(self):
        for species, kind in (("dog", "quadruped"), ("rabbit", "quadruped"),
                              ("fish", "fish"), ("angelfish", "fish")):
            left = blush_position(species, kind, -1, .5, .9, 1, .4, .34, 1.25)
            right = blush_position(species, kind, 1, .5, .9, 1, .4, .34, 1.25)
            self.assertEqual(len(left), 3)
            self.assertAlmostEqual(left[0], -right[0])
            self.assertAlmostEqual(left[1], right[1])
            self.assertAlmostEqual(left[2], right[2])
            self.assertGreater(right[1], 0)
        with self.assertRaises(ValueError):
            blush_position("dog", "quadruped", 0, .5, .9, 1, .4, .34, 1.25)


if __name__ == "__main__":
    unittest.main()
