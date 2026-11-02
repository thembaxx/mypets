"""Render real Blender geometry from different angles for owner review.

Do not mistake these workbench material previews for final PBR or mobile QA.
Run after opening source .blend: blender -b file.blend --python scripts/render-calico-review.py -- --output-dir ...
"""
import argparse
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector


def camera_at(name, where, look):
    data = bpy.data.cameras.new(name)
    ob = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(ob)
    ob.location = where
    direction = Vector(look) - ob.location
    ob.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    data.type = "ORTHO"
    data.ortho_scale = 3.45
    bpy.context.scene.camera = ob


def clip(name, frame):
    rig = bpy.data.objects["NuzzleCalicoArmature"]
    for track in rig.animation_data.nla_tracks:
        track.mute = track.name != name
    bpy.context.scene.frame_set(frame)


def main():
    args = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", required=True)
    options = parser.parse_args(args)
    out = Path(options.output_dir)
    out.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "MATERIAL"
    scene.display.shading.show_shadows = True
    scene.display.shading.show_cavity = True
    scene.render.resolution_x = 720
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.display.shading.background_type = "WORLD"
    scene.display.shading.background_color = (.92,.91,.86)
    for name,xyz,which,frame in (
        ("front", (0, 5.2, 2.15), "Idle", 9),
        ("three-quarter", (3.6, 4.7, 2.4), "Idle", 9),
        ("side", (5.4, 0.2, 2.1), "Idle", 9),
        ("feeding", (2.2, 5.1, 2.20), "Eat", 21),
        ("walking", (2.5, 4.9, 2.15), "Walk", 17),
    ):
        camera_at("Review-"+name, xyz, (0, .18, 1.18))
        clip(which, frame)
        scene.render.filepath = str(out / ("calico-" + name + ".png"))
        bpy.ops.render.render(write_still=True)
    print("Review renders generated:", [p.name for p in out.glob("*.png")])


if __name__ == "__main__":
    main()
