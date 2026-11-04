"""Prepare a generated image-to-3D GLB as an editable, source-referenced Blender project.

This intentionally does not invent skeletons or animations from a static mesh.
Use it for *review candidates*, not for automatic replacement of original art.

blender -b --factory-startup --python-exit-code 1 \
  --python scripts/import-image3d-blender.py -- \
  --species cat --input-glb /path/to/downloaded-cat.glb --output-dir /tmp/cat-review
"""
import argparse
import base64
import hashlib
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from image3d_glb import inspect_glb


def digest(path):
    # Large original-quality GLBs should not be copied into RAM for hashing.
    result = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            result.update(chunk)
    return result.hexdigest()


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
    # Cycles evaluates the generated GLB's actual PBR texture maps. A
    # Workbench screenshot would misleadingly flatten a textured AI model.
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 48
    scene.render.image_settings.file_format = "PNG"
    # The Ubuntu Blender build may omit OpenImageDenoiser; retain actual PBR
    # surfaces and disable only the optional incompatible denoiser.
    for layer in scene.view_layers:
        if hasattr(layer, "cycles"):
            layer.cycles.use_denoising = False
    scene.render.film_transparent = False
    if scene.world is None:
        scene.world = bpy.data.worlds.new("Original-art review studio")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    if background:
        background.inputs["Color"].default_value = (.63, .65, .69, 1)
        background.inputs["Strength"].default_value = .5
    # Avoid the nearly invisible cream-on-white coats seen in prior chibi
    # Cycles previews: a legitimate render is not automatically a likeness.
    scene.view_settings.exposure = -.65
    for name, offset, power in (
        ("Review key", (0.9, 1.3, 1.8), 160),
        ("Review fill", (-1.1, -1.0, 0.8), 70),
    ):
        lamp_data = bpy.data.lights.new(name, "AREA")
        lamp = bpy.data.objects.new(name, lamp_data)
        bpy.context.scene.collection.objects.link(lamp)
        lamp.location = centre + Vector(offset) * max(span, 0.25)
        lamp.rotation_euler = (centre - lamp.location).to_track_quat("-Z", "Y").to_euler()
        lamp_data.energy = power * max(span, 0.4) ** 2
        lamp_data.shape = "DISK"
        lamp_data.size = span * 2
    scene.render.resolution_x = 800
    scene.render.resolution_y = 800
    scene.render.resolution_percentage = 100


def render_fidelity_views(output, species, reference, low, high, span):
    """Render actual geometry from several directions for human likeness review.

    +Y is only an initial camera assumption: generated image-to-3D sources can
    use arbitrary orientation. Reviewers must align front in Blender first.
    """
    camera = bpy.context.scene.camera
    centre = (low + high) / 2
    bpy.context.scene.frame_set(1)
    poses = {
        "front": (0, 1.7, .2),
        "three-quarter": (.9, 1.5, .55),
        "side": (1.7, 0, .2),
        "back": (0, -1.7, .2),
    }
    views = []
    for name, direction in poses.items():
        camera.location = centre + Vector(direction) * span
        camera.rotation_euler = (centre - camera.location).to_track_quat("-Z", "Y").to_euler()
        filename = species + "-image3d-" + name + ".png"
        bpy.context.scene.render.filepath = str(output / filename)
        bpy.ops.render.render(write_still=True)
        views.append((name, filename))
    # Restore the editable Blender project to the three-quarter view.
    camera.location = centre + Vector(poses["three-quarter"]) * span
    camera.rotation_euler = (centre - camera.location).to_track_quat("-Z", "Y").to_euler()
    original_image = base64.b64encode(reference.read_bytes()).decode("ascii")
    cards = "".join(
        '<figure><img src="' + filename + '" alt="' + name + ' camera view">'
        '<figcaption>' + name.title() + '</figcaption></figure>'
        for name, filename in views
    )
    gallery = output / (species + "-fidelity-review.html")
    gallery.write_text(
        '<!doctype html><html lang="en"><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<title>' + species + ' original-to-3D review</title>'
        '<style>body{font:16px system-ui;margin:0 auto;padding:24px;max-width:1250px;'
        'background:#f5f3ed;color:#302d2b}main{display:grid;'
        'grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:18px}'
        'figure{margin:0;background:white;border-radius:18px;padding:14px}'
        'img{display:block;width:100%;aspect-ratio:1;object-fit:contain}'
        'figcaption{padding:12px 0 2px;font-weight:650}</style>'
        '<h1>Original-to-3D fidelity review: ' + species + '</h1>'
        '<p>Inspect silhouette, markings, eye and muzzle shape, proportions,'
        ' fur and hidden anatomy. Camera front orientation is provisional.'
        ' These are actual Blender renders, not photo projections.'
        ' No model has been approved or auto-rigged.</p><main>'
        '<figure><img src="data:image/jpeg;base64,' + original_image + '"'
        ' alt="Original supplied animal image"><figcaption>Original image'
        ' — source of truth</figcaption></figure>' + cards + '</main></html>',
        encoding="utf-8")
    return [filename for _, filename in views], gallery.name


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
    views, gallery = render_fidelity_views(output, args.species, reference, low, high, span)
    bpy.ops.file.pack_all()
    blend = output / (args.species + "-image3d-review.blend")
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))

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
        "review_views": views,
        "fidelity_review_gallery": gallery,
        "likeness_approved": False,
        "rigged_and_animated": exported["rigged_and_animated"],
        "needs_artistic_rigging": not exported["rigged_and_animated"],
        "note": "Static image-to-3D meshes do not animate automatically. Compare original likeness, sculpt, retopologize, rig, animate and manually review before any release.",
    }
    (output / (args.species + "-image3d-review.json")).write_text(
        json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    print("IMAGE3D_BLENDER_REVIEW " + json.dumps(metadata), flush=True)


if __name__ == "__main__":
    main()
