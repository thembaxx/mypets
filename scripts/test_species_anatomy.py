"""Unit tests of continuous skull/rostrum curvature, independent of Blender."""
import math
import unittest
from species_anatomy import LENGTHS, REPTILES, contour, head_eye_offset


class AnatomicalHeadTests(unittest.TestCase):
    def test_all_nine_land_animals_have_smooth_closed_skull_profiles(self):
        self.assertEqual(len(LENGTHS), 9)
        for slug in LENGTHS:
            self.assertGreater(LENGTHS[slug], 1.0)
            self.assertTrue(math.isfinite(head_eye_offset(slug)))
            self.assertGreaterEqual(head_eye_offset(slug), .53)
            previous = None
            for i in range(501):
                u = i/500
                values = contour(slug, u)
                self.assertEqual(len(values), 3)
                self.assertTrue(all(math.isfinite(v) for v in values))
                self.assertGreater(values[0], 0)
                self.assertGreater(values[1], 0)
                if previous is not None:
                    self.assertLess(abs(values[0]-previous[0]), .045, slug)
                    self.assertLess(abs(values[1]-previous[1]), .045, slug)
                previous = values
            self.assertGreater(contour(slug, .3)[0], contour(slug, .95)[0])

    def test_canine_long_snout_and_reptile_dorsal_profiles_differ(self):
        self.assertGreater(LENGTHS["dog"], LENGTHS["rabbit"])
        self.assertGreater(LENGTHS["ferret"], LENGTHS["guinea-pig"])
        for slug in REPTILES:
            self.assertLess(contour(slug, .42)[1], contour("dog", .42)[1])
        self.assertLess(contour("ferret", .41)[0], contour("dog", .41)[0])

    def test_invalid_species_and_profile_samples_rejected(self):
        with self.assertRaises(ValueError):
            contour("fish", .5)
        for t in (float("nan"), -0.01, 1.01, float("inf")):
            with self.assertRaises(ValueError):
                contour("dog", t)


if __name__ == "__main__":
    unittest.main()
