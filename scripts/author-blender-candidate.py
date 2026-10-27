"""Create original, non-production Blender review assets.

Run inside Blender (bpy is not a pip/browser dependency):
  blender --background --factory-startup --python scripts/author-blender-candidate.py -- \
    --preset paw --output-dir /tmp/blender-candidates

Source .blend, embedded GLB and provenance JSON are written together.
Nothing updates public/models/, approvedTripoModels, or production UI.
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy


def material(name, color, roughness=0.7, metallic=0.0):
    value = bpy.data.materials.new(name)
    value.diffuse_color = (*color, 1.0)
    value.use_nodes = True
    shader = value.node_tree.nodes.get("Principled BSDF")
    if shader:
        shader.inputs["Base Color"].default_value = (*color, 1.0)
        shader.inputs["Roughness"].default_value = roughness
        shader.inputs["Metallic"].default_value = metallic
    return value


def sphere(name, parent, location, scale, surface, segments=16, rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments, ring_count=rings, location=location
    )
    obj = bpy.context.object
    obj.name = name
    obj.parent = parent
    obj.scale = scale
    obj.data.materials.append(surface)
    for face in obj.data.polygons:
        face.use_smooth = True
    return obj


def cylinder(name, parent, location, radius, depth, surface, vertices=48):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radius, depth=depth, location=location
    )
    obj = bpy.context.object
    obj.name = name
    obj.parent = parent
    obj.data.materials.append(surface)
    for face in obj.data.polygons:
        face.use_smooth = True
    return obj


def empty(name, parent=None, location=(0, 0, 0)):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.location = location
    return obj


def animate_axis(obj, property_name, index, poses):
    for frame, value in poses:
        getattr(obj, property_name)[index] = value
        obj.keyframe_insert(data_path=property_name, index=index, frame=frame)


def paw_scene():
    root = empty("PAW_CHARM__original_review_only")
    blush = material("Paw blush", (0.82, 0.45, 0.32))
    cream = material("Paw warm ivory", (1.0, 0.89, 0.73))
    pink = material("Paw rose pads", (0.98, 0.63, 0.55))
    sage = material("Nuzzle sage accent", (0.50, 0.67, 0.48))
    gold = material("Soft gold accent", (0.76, 0.59, 0.34), 0.34, 0.25)
    sphere("Large paw pad", root, (0, 0, -0.12), (0.60, 0.44, 0.20), blush)
    sphere("Paw heart pad", root, (0, -0.06, 0.09), (0.35, 0.24, 0.045), cream)
    for i, x in enumerate((-0.44, -0.16, 0.16, 0.44)):
        y = 0.52 - abs(x) * 0.20
        sphere("Toe %s" % (i+1), root, (x, y, 0.01),
               (0.19, 0.27, 0.14), pink if i % 2 else cream)
    ring = empty("Keyring anchor", root, (0, 0.85, 0.02))
    for i in range(12):
        theta = 2 * math.pi * i / 12
        sphere("Gold ring bead %02d" % i, ring,
               (math.cos(theta) * 0.20, math.sin(theta) * 0.20, 0),
               (0.055, 0.055, 0.055), gold, 10, 8)
    heart = empty("Floating accent pivot", root, (0.77, 0.06, 0.12))
    sphere("Little heart left", heart, (-0.09, 0.04, 0),
           (0.16, 0.15, 0.08), pink)
    sphere("Little heart right", heart, (0.09, 0.04, 0),
           (0.16, 0.15, 0.08), pink)
    sphere("Little heart tip", heart, (0, -0.08, 0),
           (0.16, 0.17, 0.08), pink)
    sphere("Sage sparkle", root, (-0.62, 0.27, 0.03),
           (0.13, 0.06, 0.04), sage)
    animate_axis(root, "rotation_euler", 2,
                 [(1, -0.07), (25, 0.08), (49, -0.07)])
    animate_axis(heart, "location", 1,
                 [(1, 0.06), (25, 0.17), (49, 0.06)])
    return "mypets-paw-blender-candidate"


def dish_scene():
    root = empty("PLATED_DISH__original_review_only")
    ceramic = material("Cream ceramic", (0.94, 0.90, 0.79), 0.43)
    rim = material("Sandy stone rim", (0.81, 0.75, 0.64), 0.5)
    sauce = material("Saffron sauce", (0.92, 0.63, 0.24), 0.72)
    tomato = material("Tomato red", (0.84, 0.29, 0.19))
    herb = material("Fresh basil", (0.32, 0.52, 0.25), 0.9)
    lime = material("Lime green", (0.64, 0.76, 0.35), 0.8)
    seed = material("Toasted sesame", (0.96, 0.85, 0.56), 0.85)
    cylinder("Ceramic plate", root, (0, 0, 0), 0.82, 0.12, ceramic)
    cylinder("Raised plate lip", root, (0, 0, 0.064), 0.80, 0.018, rim)
    cylinder("Sauce centre", root, (0, 0, 0.077), 0.64, 0.019, sauce)
    for i in range(12):
        a = 2.399963 * i
        r = 0.16 + (i % 4) * 0.12
        x, y = math.cos(a) * r, math.sin(a) * r
        sphere("Ingredient %02d" % i, root,
               (x, y, 0.15 + (i % 2)*0.018),
               (0.13, 0.10, 0.075), tomato if i % 3 == 0 else lime)
    garnish = empty("Garnish breathing pivot", root, (0, 0, 0.20))
    for i in range(7):
        a = 2 * math.pi * i / 7
        leaf = sphere("Fresh herb %02d" % i, garnish,
               (math.cos(a)*0.20, math.sin(a)*0.18, i*0.006),
               (0.12, 0.055, 0.020), herb)
        leaf.rotation_euler.z = a
    for i in range(12):
        a = 2.399963 * i
        r = 0.21 + (i % 5) * 0.071
        sphere("Sesame %02d" % i, root,
               (math.cos(a)*r, math.sin(a)*r, 0.23),
               (0.021, 0.014, 0.008), seed, 8, 6)
    animate_axis(garnish, "location", 2,
                 [(1, 0.20), (25, 0.234), (49, 0.20)])
    return "mise-plated-blender-candidate"


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--preset", required=True, choices=("paw", "dish"))
    parser.add_argument("--output-dir", required=True)
    options = parser.parse_args(argv)
    out_dir = Path(options.output_dir).expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 49
    bpy.context.scene.render.fps = 24

    name = paw_scene() if options.preset == "paw" else dish_scene()
    if len([o for o in bpy.context.scene.objects if o.type == "MESH"]) > 80:
        raise RuntimeError("Candidate exceeded 80-mesh authoring budget")
    blend_path, glb_path = out_dir / (name + ".blend"), out_dir / (name + ".glb")
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path), check_existing=False)
    bpy.ops.export_scene.gltf(
        filepath=str(glb_path),
        export_format="GLB",
        export_animations=True,
        export_materials="EXPORT",
        use_visible=True,
        export_yup=True,
    )
    if not glb_path.is_file() or glb_path.stat().st_size > 8*1024*1024:
        raise RuntimeError("Missing or oversized GLB candidate")
    manifest = {
        "project": options.preset, "source": blend_path.name,
        "candidate": glb_path.name, "generator": "Blender bpy",
        "blender_version": bpy.app.version_string,
        "sha256": hashlib.sha256(glb_path.read_bytes()).hexdigest(),
        "review_status": "UNAPPROVED",
        "notes": "Original procedural Blender work; not an approved replacement for live assets",
    }
    (out_dir / (name + ".json")).write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
