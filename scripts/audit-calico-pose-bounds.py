"""Reject exploded/teleported mesh vertices in each authored pose.

This tests actual evaluated Blender geometry, including armature deformation.
Synthetic camera shadow streaks are a separate Workbench rendering issue.
"""
import json
import math
from pathlib import Path
import sys

import bpy

MAX_X = 3.5
MAX_Y = 3.8
MIN_Z = -0.08
MAX_Z = 3.7

def main():
    args = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
    if len(args) != 1:
        raise RuntimeError("Provide output directory after --")
    out = Path(args[0])
    rig = bpy.data.objects["NuzzleCalicoArmature"]
    report = []
    for clip,frame in (("Idle",9),("Eat",21),("Walk",17),("Groom",21),("Sniff",21)):
        for track in rig.animation_data.nla_tracks:
            track.mute = track.name != clip
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        graph = bpy.context.evaluated_depsgraph_get()
        worst = []
        bounds = [float("inf")]*3 + [-float("inf")]*3
        vertices_checked=0
        for ob in bpy.data.objects:
            if ob.type != "MESH":
                continue
            evaluated = ob.evaluated_get(graph)
            mesh = evaluated.to_mesh(preserve_all_data_layers=False, depsgraph=graph)
            try:
                for v in mesh.vertices:
                    coords = evaluated.matrix_world @ v.co
                    x,y,z = coords
                    vertices_checked += 1
                    for i,value in enumerate((x,y,z)):
                        bounds[i]=min(bounds[i],value)
                        bounds[i+3]=max(bounds[i+3],value)
                    if not (math.isfinite(x) and math.isfinite(y) and math.isfinite(z)
                            and -MAX_X <= x <= MAX_X and -MAX_Y <= y <= MAX_Y
                            and MIN_Z <= z <= MAX_Z):
                        if len(worst)<6:
                            worst.append({"object":ob.name,"vertex":v.index,
                                          "position":tuple(round(a,3) for a in coords)})
            finally:
                evaluated.to_mesh_clear()
        if vertices_checked<10000 or worst:
            raise RuntimeError(
                "CALICO_POSE_OUTLIER "+json.dumps({"clip":clip,"count":vertices_checked,
                                                   "bounds":bounds,"outliers":worst}))
        report.append({"clip":clip,"frame":frame,"vertices":vertices_checked,
                       "bounds":[round(x,4) for x in bounds]})
    dest=out/"calico-evaluated-pose-bounds.json"
    dest.write_text(json.dumps(report,indent=2)+"\n")
    print("CALICO_EVALUATED_POSES_PASS "+json.dumps(report),flush=True)

if __name__=="__main__":
    main()
