"""World-space skinned paw contact metrics for review, not a physics solver.

The existing in-place Walk clip has no root displacement. Reporting horizontal
stance travel is essential: paw Z close to the floor does not prove no slip.
"""
import math


def stance_slip_summary(frames, paws):
    """Measure consecutive contact-point drift for sampled planted paws.

    Reset at each swing interval so a teleport to the *next* stance phase
    cannot hide inside a cumulative distance. Input coordinates are WORLD XY.
    """
    if not frames or not paws:
        raise ValueError("Require sampled Blender frames and paw names")
    summary = {}
    for name in paws:
        previous = None
        distances = []
        for frame in frames:
            observation = frame["paws"][name]
            if not observation["stance"]:
                previous = None
                continue
            point = observation["contact_xy"]
            if len(point) != 2 or not all(math.isfinite(v) for v in point):
                raise ValueError("Invalid evaluated contact coordinates for " + name)
            if previous is not None:
                distances.append(math.hypot(point[0]-previous[0],
                                            point[1]-previous[1]))
            previous = point
        summary[name] = {
            "paired_stance_samples": len(distances),
            "max_step_m": round(max(distances, default=0.0), 5),
            "sampled_stance_path_m": round(sum(distances), 5),
        }
    if not any(row["paired_stance_samples"] > 0 for row in summary.values()):
        raise ValueError("No consecutive planted-frame pairs")
    return summary
