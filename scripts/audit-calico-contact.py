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

PAWS = ("Front_L", "Front_R", "Rear_L", "Rear_R")
FRAMES = tuple(range(1, 50, 3)) + (49,)


def evaluated_bounds(name):
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
        points = [matrix @ vertex.co for vertex in mesh.vertices]
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


def audit():
    measurements = []
    for frame in FRAMES:
        evaluate("Walk", frame)
        t = (frame-1)/48
        paw = {}
        for name in PAWS:
            pad = evaluated_bounds(name + " rosy toe pad")
            lower = evaluated_bounds(name + " lower paw")
            fore = name.startswith("Front")
            side = -1 if name.endswith("_L") else 1
            _, _, stance = foot_target(t, fore, side)
            paw[name] = {
                "stance": stance,
                "pad_low_z": round(pad["min"][2],5),
                "paw_low_z": round(lower["min"][2],5),
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
        paw = evaluated_bounds("Front_L lower paw")["centre"]
        muzzle = evaluated_bounds("Left muzzle")["centre"]
        grooming.append({"frame":frame,
                         "paw_to_muzzle":round(distance(paw,muzzle),5),
                         "paw":tuple(round(v,5) for v in paw),
                         "muzzle":tuple(round(v,5) for v in muzzle)})
    report = {
        "basis":"Blender 4 evaluated skinned mesh vertices; world metres",
        "version":1,
        "ground_z":0,
        "walk":{
            "frames":measurements,
            "stance_pad_z_min":round(min(v["pad_low_z"] for v in stance),5),
            "stance_pad_z_max":round(max(v["pad_low_z"] for v in stance),5),
            "swing_pad_z_min":round(min(v["pad_low_z"] for v in swing),5),
            "swing_pad_z_max":round(max(v["pad_low_z"] for v in swing),5),
            "deepest_paw_z":round(min(v["paw_low_z"] for v in all_paws),5),
        },
        "eat":{"frames":eating,"nearest_mouth_food":min(v["mouth_to_food"] for v in eating)},
        "groom":{"frames":grooming,"nearest_paw_muzzle":min(v["paw_to_muzzle"] for v in grooming)},
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
