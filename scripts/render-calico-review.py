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
    # A ground receiver makes paw contact testable in the actual review images.
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -.012))
    ground = bpy.context.object
    ground.name = "Review floor, not part of export"
    floor_material = bpy.data.materials.new("Soft studio ground")
    floor_material.diffuse_color = (.89, .87, .83, 1)
    ground.data.materials.append(floor_material)
    scene.display.shading.show_shadows = True
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
    # A real Blender-rendered action sequence, not a still image with motion.
    # The ceramic bowl is a review prop, deliberately not baked into the cat GLB.
    bowl_material = bpy.data.materials.new("Review bowl sage")
    bowl_material.diffuse_color = (.45, .66, .54, 1)
    food_material = bpy.data.materials.new("Review food amber")
    food_material.diffuse_color = (.65, .37, .20, 1)
    bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=.44,
                                        depth=.20, location=(0,1.39,.13))
    bowl = bpy.context.object
    bowl.name = "Eating animation preview bowl"
    bowl.data.materials.append(bowl_material)
    for index in range(8):
        a = 2*math.pi*index/8
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,
                                             location=(math.cos(a)*.23,
                                                       1.39+math.sin(a)*.23,.25))
        bite = bpy.context.object
        bite.name = "Review kibble %02d" % index
        bite.scale = (.085,.08,.04)
        bite.data.materials.append(food_material)
    camera_at("Eating video review", (2.2,4.9,2.15), (0,.54,1.05))
    clip("Eat", 1)
    scene.render.resolution_x = 560
    scene.render.resolution_y = 560
    scene.frame_start = 1
    scene.frame_end = 49
    scene.render.fps = 24
    scene.render.image_settings.file_format = "FFMPEG"
    scene.render.ffmpeg.format = "MPEG4"
    scene.render.ffmpeg.codec = "H264"
    scene.render.ffmpeg.constant_rate_factor = "MEDIUM"
    scene.render.filepath = str(out / "calico-feeding-preview.mp4")
    bpy.ops.render.render(animation=True)
    if not (out / "calico-feeding-preview.mp4").is_file():
        raise RuntimeError("Could not produce actual eating animation video")
    print("Real review video rendered:", (out / "calico-feeding-preview.mp4").stat().st_size)
    print("Review renders generated:", [p.name for p in out.glob("*.png")])


if __name__ == "__main__":
    main()
