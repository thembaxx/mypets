"""Check exported Blender rig's real animated bone tips, not source math alone.

Blender sometimes caches manual pose changes before NLA baking. This QA
deliberately opens the *saved* .blend and evaluates named exported NLA strips.
Measured ankle (shin tip) positions must follow the authored constraints.
It does not certify skin deformation/mesh collision or full world-locked IK.
"""
import argparse
import json
import sys
from pathlib import Path
import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from calico_gait import foot_target, SOLE_OFFSET  # noqa: E402


def main():
    args = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", required=True)
    out = Path(parser.parse_args(args).output_dir)
    rig = bpy.data.objects["NuzzleCalicoArmature"]
    for track in rig.animation_data.nla_tracks:
        track.mute = track.name != "Walk"
    scene = bpy.context.scene
    max_y_error = 0.0
    max_z_error = 0.0
    max_stance_height_error = 0.0
    actual_swing_clearance = 0.0
    samples = []
    for frame in range(1,50,2):
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        t = (frame-1)/48
        for fore in (True,False):
            for side in (-1,1):
                name = ("Front" if fore else "Rear")+("_L" if side < 0 else "_R")
                hip = rig.matrix_world @ rig.pose.bones[name+"_Upper"].head
                ankle = rig.matrix_world @ rig.pose.bones[name+"_Lower"].tail
                target_y, target_z, planted = foot_target(t,fore,side)
                dy=abs((ankle.y-hip.y)-target_y)
                dz=abs(ankle.z-target_z)
                max_y_error=max(max_y_error,dy)
                max_z_error=max(max_z_error,dz)
                if planted:
                    max_stance_height_error=max(max_stance_height_error,
                                                 abs(ankle.z-SOLE_OFFSET))
                else:
                    actual_swing_clearance=max(actual_swing_clearance,ankle.z)
                if frame in (1,13,25,37,49):
                    samples.append({"frame":frame,"paw":name,
                                    "z":round(ankle.z,4),
                                    "expected_z":round(target_z,4),
                                    "dy":round(dy,4),"dz":round(dz,4)})
    # The saved action must also put the *actual nose mesh* at food height,
    # not through the floor. Checking only a head-bone transform misses this.
    for track in rig.animation_data.nla_tracks:
        track.mute = track.name != "Eat"
    scene.frame_set(21)
    bpy.context.view_layer.update()
    nose = bpy.data.objects["Heart shaped coral nose"]
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = nose.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    try:
        nose_centre = sum((evaluated.matrix_world @ v.co for v in mesh.vertices),
                          __import__("mathutils").Vector()) / len(mesh.vertices)
    finally:
        evaluated.to_mesh_clear()
    nose_height = nose_centre.z
    bowl_distance_xy = ((nose_centre.x)**2+(nose_centre.y-1.39)**2)**.5
    report={"model":"Nuzzle calico gait QA","status":"unapproved",
            "frames":25,"bone_samples":100,"max_y_error":round(max_y_error,4),
            "max_z_error":round(max_z_error,4),
            "max_stance_height_error":round(max_stance_height_error,4),
            "max_swing_height":round(actual_swing_clearance,4),
            "feeding_nose_z":round(nose_height,4),
            "feeding_nose_bowl_horizontal_distance":round(bowl_distance_xy,4),
            "samples":samples}
    (out/"calico-gait-qa.json").write_text(json.dumps(report,indent=2)+"\n")
    print("CALICO-GAIT-QA "+json.dumps(report),flush=True)
    # Rig anatomy/world-space math must agree. Any failure blocks publication.
    if max_y_error > .065 or max_z_error > .065:
        raise RuntimeError("Exported Blender bone tips disagree with authored two-bone IK")
    if actual_swing_clearance < SOLE_OFFSET+.09:
        raise RuntimeError("Walk has no real vertical swing clearance")
    if not (.18 <= nose_height <= .55):
        raise RuntimeError("Eating pose nose height is unsafe for a 0.25m food bowl: %.3f" % nose_height)
    if bowl_distance_xy > .65:
        raise RuntimeError("Eating pose misses the center of the food bowl horizontally")


if __name__=="__main__":
    main()
