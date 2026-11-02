import math
import unittest
from calico_gait import (SOLE_OFFSET, foot_target, root_height, solve_2bone,
                         ankle_from_angles, walk_leg_pose, groom_paw_pose,
                         walk_weight_shift)


class TestQuadrupedContact(unittest.TestCase):
    def test_walk_targets_reachable_without_limb_stretching(self):
        for i in range(1001):
            t = i/1000
            for fore in (True,False):
                for side in (-1,1):
                    angles,(y,z),planted = walk_leg_pose(t,fore,side)
                    ty,tz,_ = foot_target(t,fore,side)
                    self.assertAlmostEqual(y,ty,places=8)
                    self.assertAlmostEqual(z,tz,places=8)
                    self.assertTrue(all(math.isfinite(a) for a in angles))
                    self.assertGreaterEqual(z,SOLE_OFFSET-1e-8)
                    if planted: self.assertAlmostEqual(z,SOLE_OFFSET,places=8)

    def test_loop_seam_preserves_all_four_leg_angles(self):
        self.assertAlmostEqual(root_height(0),root_height(1),places=10)
        for fore in (True,False):
            for side in (-1,1):
                first,last=walk_leg_pose(0,fore,side),walk_leg_pose(1,fore,side)
                for a,b in zip(first[0],last[0]):
                    self.assertAlmostEqual(a,b,places=10)

    def test_diagonal_support_and_nonzero_swing_clearance(self):
        for t in (.06,.19,.32,.44,.56,.69,.81,.94):
            self.assertEqual(walk_leg_pose(t,True,-1)[2],
                             walk_leg_pose(t,False,1)[2])
        self.assertGreater(max(walk_leg_pose(i/1000,True,-1)[1][1]
                               for i in range(1001)),SOLE_OFFSET+.125)

    def test_walk_weight_transfer_is_bounded_and_loop_safe(self):
        first = walk_weight_shift(0)
        last = walk_weight_shift(1)
        for left, right in zip(first, last):
            self.assertAlmostEqual(left, right, places=10)
        for step in range(1001):
            sway, pitch = walk_weight_shift(step/1000)
            self.assertTrue(math.isfinite(sway) and math.isfinite(pitch))
            self.assertLessEqual(abs(sway), .01600001)
            self.assertLessEqual(abs(pitch), .01200001)

    def test_rejects_unreachable_ankles(self):
        with self.assertRaises(ValueError): solve_2bone(0,-1.5)
        with self.assertRaises(ValueError): solve_2bone(0,0)
        first,second=solve_2bone(.72,.10)
        y,z=ankle_from_angles(first,second)
        self.assertAlmostEqual(y,.72,places=9)
        self.assertAlmostEqual(z,.10,places=9)

    def test_grooming_target_reaches_near_lower_cheek(self):
        y,z=ankle_from_angles(*groom_paw_pose(1))
        self.assertAlmostEqual(y,.72,places=8)
        self.assertAlmostEqual(z,.10,places=8)
        for i in range(101):
            angles=groom_paw_pose(i/100)
            self.assertTrue(all(math.isfinite(a) for a in angles))


if __name__=="__main__":
    unittest.main()
