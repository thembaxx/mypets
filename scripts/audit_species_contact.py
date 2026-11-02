"""Measure evaluated world-space locomotion of every experimental species.

This uses Blender's evaluated, armature-deformed vertices of the *authored*
Walk clip. It reports sampled travel and distance above the nominal ground.
A low foot or moving fin is NOT proof of collision response, force feedback,
true no-slip walking, or realistic swimming.
"""
import json
import math
from pathlib import Path

import bpy

from species_motion import planted_phase


def evaluated_samples(name, lower_only=False):
    original = bpy.data.objects.get(name)
    if original is None or original.type != "MESH":
        raise ValueError("Missing evaluated review mesh " + name)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    obj = original.evaluated_get(depsgraph)
    mesh = obj.to_mesh(preserve_all_data_layers=False, depsgraph=depsgraph)
    try:
        floor = min(v.co.z for v in original.data.vertices)
        cutoff = floor + .043
        selected = [
            obj.matrix_world @ vertex.co for vertex in mesh.vertices
            if not lower_only or original.data.vertices[vertex.index].co.z <= cutoff
        ]
        if not selected:
            raise ValueError("Empty evaluated contact patch for " + name)
        return (
            tuple(sum(p[i] for p in selected) / len(selected) for i in range(3)),
            min(p.z for p in selected),
        )
    finally:
        obj.to_mesh_clear()


def prepare_walk(rig, frame):
    rig.animation_data.action = None
    for nla in rig.animation_data.nla_tracks:
        nla.mute = nla.name != "Walk"
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()


def finite(value):
    if not math.isfinite(value):
        raise ValueError("Nonfinite evaluated motion measurement")
    return round(value, 5)


def summarize_samples(observations):
    """Count only consecutive planted samples in the same stance interval."""
    distances, floors = [], []
    previous = None
    for item in observations:
        floors.append(item["lowest_z"])
        if item["stance"] and previous is not None:
            distances.append(math.hypot(
                item["xy"][0] - previous[0], item["xy"][1] - previous[1]
            ))
        previous = item["xy"] if item["stance"] else None
    if not distances:
        raise ValueError("Need at least one consecutive stance sample")
    return {
        "stance_sample_pairs": len(distances),
        "max_sampled_xy_drift_m": finite(max(distances)),
        "total_sampled_xy_travel_m": finite(sum(distances)),
        "minimum_contact_z_m": finite(min(floors)),
        "maximum_contact_z_m": finite(max(floors)),
    }


def audit(slug, kind, rig, output_dir):
    """Generate a separate source-linked audit for each regenerated candidate."""
    times = [(frame, (frame - 1) / 48) for frame in range(1, 50, 2)]
    report = {
        "version": 1,
        "species": slug,
        "kind": kind,
        "basis": "evaluated skinned Blender vertices, nominal metres",
        "status": "REVIEW_ONLY - analytical pose, not physical contact",
        "frames": len(times),
    }
    if kind in ("quadruped", "reptile"):
        paws = {
            label: [] for label in ("Front_L", "Front_R", "Rear_L", "Rear_R")
        }
        for frame, t in times:
            prepare_walk(rig, frame)
            for label, readings in paws.items():
                name = label + " connected limb"
                centre, floor = evaluated_samples(name, lower_only=True)
                readings.append({
                    "frame": frame,
                    "xy": tuple(finite(v) for v in centre[:2]),
                    "lowest_z": finite(floor),
                    "stance": planted_phase(slug, label + "_Lower", t),
                })
        report["paw_contact"] = {
            name: summarize_samples(rows) for name, rows in paws.items()
        }
    elif kind == "bird":
        paths = {-1: [], 1: []}
        for frame, t in times:
            prepare_walk(rig, frame)
            for side, readings in paths.items():
                centre, floor = evaluated_samples(slug + " toe " + str(side) + " 0")
                readings.append({
                    "frame": frame,
                    "xy": tuple(finite(v) for v in centre[:2]),
                    "lowest_z": finite(floor),
                    "stance": math.sin(4*math.pi*t+(math.pi if side>0 else 0)) <= -0.05,
                })
        report["toe_contact"] = {
            str(side): summarize_samples(rows) for side, rows in paths.items()
        }
    else:
        sample_name = (
            slug + " sculpted caudal fin" if kind == "fish"
            else slug + " unbroken spine"
        )
        centres = []
        for frame, _ in times:
            prepare_walk(rig, frame)
            centre, floor = evaluated_samples(sample_name)
            centres.append(centre)
        report["moving_surface"] = {
            "name": sample_name,
            "sampled_xy_path_m": finite(sum(math.hypot(
                b[0]-a[0], b[1]-a[1]
            ) for a, b in zip(centres, centres[1:]))),
            "lateral_range_m": finite(max(v[0] for v in centres) -
                                      min(v[0] for v in centres)),
            "vertical_range_m": finite(max(v[2] for v in centres) -
                                       min(v[2] for v in centres)),
        }
    destination = Path(output_dir) / (slug + "-locomotion-audit.json")
    destination.write_text(json.dumps(report, indent=2) + "\n")
    print("SPECIES_CONTACT_AUDIT", slug, json.dumps(report, separators=(",", ":")), flush=True)
    return report
