"""Analytical two-link gait for Nuzzle's Blender cat.

Targets correspond to the lower shin-bone tip. The surrounding paw mesh has
approximately 6 cm of sole geometry below that tip. This is authored IK,
not a collision/force solver and not world-locked foot planting.
"""
import math

UPPER = 0.43
LOWER = 0.46
STANCE = 0.62
SOLE_OFFSET = 0.06


def smoothstep(t):
    t = max(0.0, min(1.0, t))
    return t*t*(3.0-2.0*t)


def root_height(t):
    return -.12 + .015 * math.sin(4*math.pi*t)**2


def foot_target(t, fore, side):
    # Diagonal trot pairing; two complete strides over the 49-frame cycle.
    phase = (2*t + (.5 if fore == (side < 0) else 0)) % 1
    if phase < STANCE:
        return (.15-.30*smoothstep(phase/STANCE), SOLE_OFFSET, True)
    progress = (phase-STANCE)/(1-STANCE)
    return (-.15+.30*smoothstep(progress),
            SOLE_OFFSET+.13*math.sin(math.pi*progress), False)


def solve_2bone(y, z, upper=UPPER, lower=LOWER):
    """X-hinge angles for two bones with rest direction -Z."""
    d = math.hypot(y, z)
    if not (abs(upper-lower)+1e-5 <= d <= upper+lower-1e-5):
        raise ValueError("Unreachable foot target %.4fm" % d)
    first = math.atan2(y, -z) - math.acos(max(-1., min(1.,
        (upper*upper+d*d-lower*lower)/(2*upper*d))))
    second = math.acos(max(-1., min(1.,
        (d*d-upper*upper-lower*lower)/(2*upper*lower))))
    return first, second


def ankle_from_angles(first, second, upper=UPPER, lower=LOWER):
    return (upper*math.sin(first)+lower*math.sin(first+second),
            -upper*math.cos(first)-lower*math.cos(first+second))


def walk_leg_pose(t, fore, side):
    y, ankle_height, planted = foot_target(t, fore, side)
    hip_height = (1.02 if fore else .89) + root_height(t)
    angles = solve_2bone(y, ankle_height-hip_height)
    actual_y, actual_z = ankle_from_angles(*angles)
    return angles, (actual_y, actual_z+hip_height), planted


def groom_paw_pose(reach):
    """Reach left forepaw to lower cheek; x contact is approximate."""
    reach = max(0, min(1, reach))
    y = .0 + .72*smoothstep(reach)
    z = -.84 + .94*smoothstep(reach)
    return solve_2bone(y, z)
