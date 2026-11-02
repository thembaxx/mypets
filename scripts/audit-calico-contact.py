"""Measure actual evaluated, skinned Blender contact geometry.

Unlike scripts/calico_gait.py's analytic shin-tip tests this measures deformed
mesh vertices in world coordinates after Blender evaluates each exported NLA
strip. Metrics are a diagnostic, not proof of collision-aware IK or physics.
Usage: blender -b candidate.blend --python scripts/audit-calico-contact.py -- --output-dir /tmp/calico
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from calico_gait import foot_target
from calico_contact_metrics import stance_slip_summary

PAWS = ("Front_L", "Front_R", "Rear_L", "Rear_R")
FRAMES = tuple(range(1, 50, 3)) + (49,)


def evaluated_points(name, distal_only=False):
    """Copy true armature-deformed vertex coordinates for contact testing."""
    original = bpy.data.objects.get(name)
    if original is None:
        raise RuntimeError("Missing contact object: " + name)
    graph = bpy.context.evaluated_depsgraph_get()
    obj = original.evaluated_get(graph)
    mesh = obj.to_mesh(preserve_all_data_layers=False, depsgraph=graph)
    try:
        cutoff = original.get("distal_cutoff_z") if distal_only else None
        return [obj.matrix_world @ vertex.co for vertex in mesh.vertices
                if cutoff is None or original.data.vertices[vertex.index].co.z <= cutoff]
    finally:
        obj.to_mesh_clear()


def contact_patch_xy(name, tolerance=.012):
    """Centroid of lowest evaluated paw vertices, not arbitrary shin tip."""
    points = evaluated_points(name, distal_only=True)
    if not points:
        raise RuntimeError("No evaluated contact patch vertices for " + name)
    floor = min(p.z for p in points)
    patch = [p for p in points if p.z <= floor + tolerance]
    if not patch:
        raise RuntimeError("Empty contact patch for " + name)
    return (round(sum(p.x for p in patch)/len(patch), 5),
            round(sum(p.y for p in patch)/len(patch), 5))


def minimum_surface_distance(left, right):
    """Nearest actual paw-tip vertices; centre distance is NOT surface contact."""
    a, b = evaluated_points(left, True), evaluated_points(right)
    if not a or not b:
        raise RuntimeError("Cannot measure surface contact for empty geometry")
    return min((u-v).length for u in a for v in b)


def evaluated_bounds(name, distal_only=False):
    """Bounding points after ALL live armature modifiers, in world metres."""
    original = bpy.data.objects.get(name)
    if original is None:
        raise RuntimeError("Missing contact object: " + name)
    graph = bpy.context.evaluated_depsgraph_get()
    ob = original.evaluated_get(graph)
    mesh = ob.to_mesh(preserve_all_data_layers=False, depsgraph=graph)
    try:
        if len(mesh.vertices) == 0:
            raise RuntimeError("Contact object has no vertices: " + name)
        matrix = ob.matrix_world
        cutoff = original.get("distal_cutoff_z") if distal_only else None
        points = [matrix @ vertex.co for vertex in mesh.vertices
                  if cutoff is None or original.data.vertices[vertex.index].co.z <= cutoff]
        if not points:
            raise RuntimeError("No paw-tip vertices: "+name)
        lower = tuple(min(p[axis] for p in points) for axis in range(3))
        upper = tuple(max(p[axis] for p in points) for axis in range(3))
        centre = tuple((a+b)*.5 for a,b in zip(lower,upper))
        return {"min": lower, "max": upper, "centre": centre}
    finally:
        ob.to_mesh_clear()


def evaluate(clip, frame):
    rig = bpy.data.objects["NuzzleCalicoArmature"]
    if rig.animation_data.action is not None:
        rig.animation_data.action = None
    for track in rig.animation_data.nla_tracks:
        track.mute = track.name != clip
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()


def distance(a,b):
    return math.sqrt(sum((x-y)**2 for x,y in zip(a,b)))


def connected_limb(name):
    """Compute topology connectivity directly from the saved skin mesh."""
    obj = bpy.data.objects[name]
    mesh = obj.data
    neighbors = [[] for _ in mesh.vertices]
    for edge in mesh.edges:
        a, b = edge.vertices
        neighbors[a].append(b)
        neighbors[b].append(a)
    if not neighbors:
        return False
    seen, stack = {0}, [0]
    while stack:
        for other in neighbors[stack.pop()]:
            if other not in seen:
                seen.add(other)
                stack.append(other)
    return len(seen) == len(neighbors)


def audit():
    measurements = []
    for frame in FRAMES:
        evaluate("Walk", frame)
        t = (frame-1)/48
        paw = {}
        for name in PAWS:
            pad = evaluated_bounds(name + " rosy toe pad")
            lower = evaluated_bounds(name + " lower paw", distal_only=True)
            fore = name.startswith("Front")
            side = -1 if name.endswith("_L") else 1
            _, _, stance = foot_target(t, fore, side)
            paw[name] = {
                "stance": stance,
                "pad_low_z": round(pad["min"][2],5),
                "paw_low_z": round(lower["min"][2],5),
                "contact_xy": contact_patch_xy(name + " lower paw"),
                "pad_center_y": round(pad["centre"][1],5),
                "ankle_tip_z": round((
                    bpy.data.objects["NuzzleCalicoArmature"].matrix_world
                    @ bpy.data.objects["NuzzleCalicoArmature"].pose.bones[name+"_Lower"].tail
                ).z,5),
            }
        measurements.append({"frame": frame, "paws": paw})
    all_paws = [v for frame in measurements for v in frame["paws"].values()]
    stance = [v for v in all_paws if v["stance"]]
    swing = [v for v in all_paws if not v["stance"]]
    if not stance or not swing:
        raise RuntimeError("Need both stance and swing samples")

    eating = []
    for frame in (1,7,13,19,25,31,37,43,49):
        evaluate("Eat", frame)
        mouth = evaluated_bounds("Dark living mouth")["centre"]
        nose = evaluated_bounds("Heart shaped coral nose")["centre"]
        # Review bowl in scripts/render-calico-review.py: x=0,y=1.13,z=.13
        bowl_food = (0,1.13,.25)
        eating.append({
            "frame":frame,
            "mouth_to_food":round(distance(mouth,bowl_food),5),
            "nose_to_food":round(distance(nose,bowl_food),5),
            "mouth":tuple(round(x,5) for x in mouth),
            "nose":tuple(round(x,5) for x in nose),
        })

    grooming = []
    for frame in (1,7,13,19,25,31,37,43,49):
        evaluate("Groom", frame)
        paw = evaluated_bounds("Front_L lower paw", distal_only=True)["centre"]
        muzzle = evaluated_bounds("Left muzzle")["centre"]
        grooming.append({"frame":frame,
                         "paw_to_muzzle":round(distance(paw,muzzle),5),
                         "surface_gap":round(minimum_surface_distance(
                             "Front_L lower paw", "Left muzzle"),5),
                         "connected_limb":connected_limb("Front_L lower paw"),
                         "paw":tuple(round(v,5) for v in paw),
                         "muzzle":tuple(round(v,5) for v in muzzle)})
    report = {
        "basis":"Blender 4 evaluated skinned mesh vertices; world metres",
        "version":2,
        "ground_z":0,
        "walk":{
            "frames":measurements,
            "stance_pad_z_min":round(min(v["pad_low_z"] for v in stance),5),
            "stance_pad_z_max":round(max(v["pad_low_z"] for v in stance),5),
            "swing_pad_z_min":round(min(v["pad_low_z"] for v in swing),5),
            "swing_pad_z_max":round(max(v["pad_low_z"] for v in swing),5),
            "deepest_paw_z":round(min(v["paw_low_z"] for v in all_paws),5),
            # Diagnostic only: an in-place stride intentionally travels in
            # local space. Real translation/foot locking isn't implemented.
            "planted_xy_slip":stance_slip_summary(measurements, PAWS),
        },
        "eat":{"frames":eating,"nearest_mouth_food":min(v["mouth_to_food"] for v in eating)},
        "groom":{"frames":grooming,
                 "nearest_paw_muzzle":min(v["paw_to_muzzle"] for v in grooming),
                 "nearest_surface_gap":min(v["surface_gap"] for v in grooming),
                 "connected_limb":all(v["connected_limb"] for v in grooming)},
        "status":"REVIEW_NEEDED - geometry audit does not simulate contacts or forces",
    }
    for value in [report["walk"]["deepest_paw_z"],
                  report["eat"]["nearest_mouth_food"],
                  report["groom"]["nearest_paw_muzzle"]]:
        if not math.isfinite(value):
            raise RuntimeError("Nonfinite evaluated contact measurement")
    return report


def main():
    args = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir",required=True)
    options = parser.parse_args(args)
    out = Path(options.output_dir)
    out.mkdir(parents=True,exist_ok=True)
    report = audit()
    (out/"calico-geometry-contact.json").write_text(json.dumps(report,indent=2)+"\n")
    print("CALICO-CONTACT:"+json.dumps({k:v for k,v in report.items() if k not in ("basis","version","ground_z","status")},separators=(",",":")))
    print("Blender mesh-ground, grooming and eating audit saved to",out)


if __name__=="__main__":
    main()
