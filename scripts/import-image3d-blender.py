"""Prepare a generated image-to-3D GLB as an editable, source-referenced Blender project.

This intentionally does not invent skeletons or animations from a static mesh.
Use it for *review candidates*, not for automatic replacement of original art.

blender -b --factory-startup --python-exit-code 1 \
  --python scripts/import-image3d-blender.py -- \
  --species cat --input-glb /path/to/downloaded-cat.glb --output-dir /tmp/cat-review
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from image3d_glb import inspect_glb


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def bounds_for(objects):
    corners = [
        ob.matrix_world @ Vector(corner)
        for ob in objects
        if ob.type == "MESH"
        for corner in ob.bound_box
    ]
    if not corners:
        raise RuntimeError("The generated model has no mesh bounds")
    low = Vector(tuple(min(pt[i] for pt in corners) for i in range(3)))
    high = Vector(tuple(max(pt[i] for pt in corners) for i in range(3)))
    return low, high, max((high - low).length, 0.01)


def attach_packed_original(species, reference_path, low, high, span):
    """Viewport-only comparison plate. It is NOT projected onto the new mesh."""
    image = bpy.data.images.load(str(reference_path), check_existing=False)
    image.pack()
    plate = bpy.data.objects.new("REFERENCE ONLY - " + species + " original image", None)
    bpy.context.scene.collection.objects.link(plate)
    plate.empty_display_type = "IMAGE"
    plate.data = image
    plate.empty_display_size = span * .85
    plate.empty_image_depth = "FRONT"
    plate.location = (low.x - span * .75, (low.y + high.y) / 2, (low.z + high.z) / 2)
    plate.rotation_euler.x = -1.57079632679
    plate.hide_render = True
    return plate


def setup_review_camera(low, high, span):
    centre = (low + high) / 2
    camera_data = bpy.data.cameras.new("Review camera")
    camera = bpy.data.objects.new("Review camera", camera_data)
    bpy.context.scene.collection.objects.link(camera)
    camera.location = centre + Vector((span * .75, span * 1.4, span * .6))
    camera.rotation_euler = (centre - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = span * 2.25
    bpy.context.scene.camera = camera
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.color_type = "MATERIAL"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.show_shadows = True
    scene.render.resolution_x = 800
    scene.render.resolution_y = 800
    scene.render.resolution_percentage = 100


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--species", required=True)
    parser.add_argument("--input-glb", required=True)
    parser.add_argument("--output-dir", required=True)
    args = parser.parse_args(argv)

    repo_root = Path(__file__).resolve().parent.parent
    reference = repo_root / "assets" / "animal-originals" / (args.species + ".jpg")
    if args.species != reference.stem or not reference.is_file():
        parser.error("Unknown animal ID; use the name of an existing original JPG")
    source = Path(args.input_glb).expanduser().resolve(strict=True)
    output = Path(args.output_dir).expanduser().resolve()
    output.mkdir(parents=True, exist_ok=True)
    source_metrics = inspect_glb(source)  # Reject external resources before importing.

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source))
    imported = list(bpy.context.scene.objects)
    if not any(ob.type == "MESH" for ob in imported):
        raise RuntimeError("Blender imported no mesh geometry")
    low, high, span = bounds_for(imported)

    # Preserve authored animation, transforms, materials and skinning, if any.
    # Export only the imported scene (not the reference plate or review camera).
    bpy.ops.object.select_all(action="DESELECT")
    for ob in imported:
        if ob.type in {"MESH", "ARMATURE", "EMPTY"}:
            ob.select_set(True)
    mesh = next(ob for ob in imported if ob.type == "MESH")
    bpy.context.view_layer.objects.active = mesh
    candidate = output / (args.species + "-image3d-review.glb")
    bpy.ops.export_scene.gltf(
        filepath=str(candidate),
        export_format="GLB",
        use_selection=True,
        export_materials="EXPORT",
        export_animations=True,
        export_nla_strips=True,
        export_yup=True,
    )
    exported = inspect_glb(candidate)

    # Keep the full editable scene with the *actual original* image packed in.
    attach_packed_original(args.species, reference, low, high, span)
    setup_review_camera(low, high, span)
    bpy.ops.file.pack_all()
    blend = output / (args.species + "-image3d-review.blend")
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))

    bpy.context.scene.render.filepath = str(output / (args.species + "-image3d-review.png"))
    bpy.ops.render.render(write_still=True)

    # The source model is not necessarily skinned; no animation is invented.
    # Never allow this report to be mistaken for human visual approval.
    metadata = {
        "species": args.species,
        "status": "REVIEW_ONLY_NOT_APPROVED",
        "source_illustration": "assets/animal-originals/" + reference.name,
        "source_sha256": digest(reference),
        "downloaded_glb_sha256": digest(source),
        "candidate_glb_sha256": digest(candidate),
        "source_geometry": source_metrics,
        "exported_geometry": exported,
        "rigged_and_animated": bool(exported["skins"] and exported["animations"]),
        "needs_artistic_rigging": not bool(exported["skins"] and exported["animations"]),
        "note": "Static image-to-3D meshes do not animate automatically. Compare original likeness, sculpt, retopologize, rig, animate and manually review before any release.",
    }
    (output / (args.species + "-image3d-review.json")).write_text(
        json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    print("IMAGE3D_BLENDER_REVIEW " + json.dumps(metadata), flush=True)


if __name__ == "__main__":
    main()
