"""Validate loop seams and species-dependent animated posing without Blender."""
import math
import unittest
from species_motion import FOUR_LEGGED, limb_angles, tail_wave, walk_torso, wing_stroke


class SpeciesMotionTests(unittest.TestCase):
    def test_all_quadrupeds_have_bounded_four_leg_and_knee_motion(self):
        for species in FOUR_LEGGED:
            for leg in ("Front_L", "Front_R", "Rear_L", "Rear_R"):
                for suffix in ("Upper", "Lower"):
                    bone = leg + "_" + suffix
                    start = limb_angles(species, bone, 0)
                    end = limb_angles(species, bone, 1)
                    self.assertEqual(len(start), 2)
                    for a, b in zip(start, end):
                        self.assertAlmostEqual(a, b, places=9)
                    for sample in range(101):
                        upper, lower = limb_angles(species, bone, sample/100)
                        self.assertTrue(math.isfinite(upper) and math.isfinite(lower))
                        self.assertLess(abs(upper), .401)
                        self.assertLess(abs(lower), .401)

    def test_reptiles_are_less_bouncy_than_rabbits(self):
        rabbit = max(walk_torso("rabbit", "quadruped", i/100)[0]
                     for i in range(101))
        gecko = max(walk_torso("gecko", "reptile", i/100)[0]
                    for i in range(101))
        self.assertGreater(rabbit, gecko)

    def test_swimming_and_terrestrial_tail_have_distinct_amplitudes(self):
        fish = max(abs(tail_wave("fish", i/100)[1]) for i in range(101))
        dog = max(abs(tail_wave("quadruped", i/100)[1]) for i in range(101))
        self.assertGreater(fish, dog)

    def test_species_torso_and_wings_close_loops(self):
        for species, kind in (("dog", "quadruped"), ("rabbit", "quadruped"),
                              ("bird", "bird"), ("fish", "fish"),
                              ("snake", "snake"), ("gecko", "reptile")):
            for start, finish in zip(walk_torso(species, kind, 0),
                                     walk_torso(species, kind, 1)):
                self.assertAlmostEqual(start, finish, places=9)
        for moving in (True, False):
            for tip in (True, False):
                self.assertAlmostEqual(wing_stroke(0, tip, moving),
                                       wing_stroke(1, tip, moving), places=9)

    def test_bad_bone_is_not_silently_accepted(self):
        with self.assertRaises(ValueError):
            limb_angles("dog", "Tail_1", .3)
        with self.assertRaises(ValueError):
            limb_angles("fish", "Front_L_Upper", .3)


if __name__ == "__main__":
    unittest.main()
