"""Species-specific authored gait curves for MyPets' sixteen review-only rigs.

All values are bounded, phase-wrapped keyframe parameters. These curves are
not force-driven physics, collision IK, or planted-foot world locking.
No Blender imports: unit tests run without a GPU or workstation.
"""
import math

FOUR_LEGGED = {
    "dog", "rabbit", "hamster", "guinea-pig", "ferret", "hedgehog",
    "iguana", "gecko", "salamander",
}
SMALL_MAMMALS = {"hamster", "guinea-pig", "ferret", "hedgehog"}
REPTILES = {"iguana", "gecko", "salamander"}


def gait_phase(slug, name):
    """Same stance/swing phase used by the authored limb rotations.

    This permits Blender to audit a specific stance interval instead of
    guessing from whether a toe happens to be close to the ground.
    """
    if slug not in FOUR_LEGGED:
        raise ValueError("No terrestrial gait for " + slug)
    if not name.startswith(("Front_L_", "Front_R_", "Rear_L_", "Rear_R_")):
        raise ValueError("Invalid limb name: " + name)
    rear = name.startswith("Rear_")
    left = name.startswith(("Front_L_", "Rear_L_"))
    return (math.pi if rear else 0.0) if slug == "rabbit" else (
        (math.pi if left else 0.0) + (math.pi if rear else 0.0)
    )


def planted_phase(slug, name, t):
    """Approximate authored support half-cycle; NOT physical foot contact."""
    return math.sin(4 * math.pi * t + gait_phase(slug, name)) <= -0.05


def limb_angles(slug, name, t):
    """Upper/lower X rotations; diagonals, hopping and sprawling vary by species."""
    if slug not in FOUR_LEGGED:
        raise ValueError("No four-foot gait for " + slug)
    if not name.endswith(("_Upper", "_Lower")):
        raise ValueError("Not a limb bone: " + name)
    # Rabbits pair their rear legs while other animals use diagonal phases.
    phase = gait_phase(slug, name)
    angle = 4 * math.pi * t + phase
    stride = math.sin(angle)
    lift = max(0.0, math.sin(angle))
    if slug == "rabbit":
        upper = .30 if rear else .22
        lower = .39 if rear else .24
    elif slug in REPTILES:
        upper, lower = .14, .19
    elif slug in SMALL_MAMMALS:
        upper, lower = (.25, .27) if slug == "ferret" else (.18, .21)
    else:
        upper, lower = .24, .20
    return upper * stride, -lower * lift


def walk_torso(slug, kind, t):
    """Bounded vertical bob, lateral sway and counter-pitch, loop safe."""
    cadence = 3 if kind == "fish" else 2
    a = 2 * math.pi * cadence * t
    if kind == "fish":
        return .013 * math.sin(a), .037 * math.sin(a), .02 * math.cos(a)
    if kind == "bird":
        return .013 * math.sin(a)**2, .008 * math.sin(a), .016 * math.cos(a)
    if kind == "snake":
        return 0.0, .037 * math.sin(a), .025 * math.cos(a)
    if kind == "reptile":
        return .008 * math.sin(a)**2, .018 * math.sin(a), .013 * math.cos(a)
    if slug == "rabbit":
        return .028 * math.sin(a)**2, .009 * math.sin(a), .018 * math.cos(a)
    return .014 * math.sin(a)**2, .014 * math.sin(a), .010 * math.cos(a)


def tail_wave(kind, t):
    """Progressive phase offsets from tail root to tip."""
    a = (6 if kind == "fish" else 4) * math.pi * t
    amp = (.26, .41) if kind == "fish" else (.12, .22)
    return amp[0] * math.sin(a - .45), amp[1] * math.sin(a - .95)


def wing_stroke(t, tip=False, moving=False):
    a = 4 * math.pi * t
    # Walking birds keep wings gently folded; in play they lift more.
    amplitude = (.25 if tip else .20) if moving else (.065 if tip else .055)
    return amplitude * math.sin(a - (.35 if tip else 0))
