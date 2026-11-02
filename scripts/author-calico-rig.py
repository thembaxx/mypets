"""Author an original, manually reviewable, skeletal 3D calico in Blender.

Requires Blender bpy + glTF exporter; no paid API, external models or user photos.
This is a *candidate*, never an automatically approved production GLB.
Usage: blender -b -t 2 --python-exit-code 1 --python scripts/author-calico-rig.py -- --output-dir /tmp/calico
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

FPS = 24
LAST = 49


def material(name, rgb, roughness=0.83):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*rgb, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    return m


def make_mesh(name, pos, radius, mat, bone, segments=24, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings)
    ob = bpy.context.object
    ob.name = name
    ob.location = pos
    ob.scale = radius
    ob.data.materials.append(mat)
    for f in ob.data.polygons:
        f.use_smooth = True
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bind(ob, bone)
    return ob


def make_cone(name, pos, radius, depth, mat, bone):
    bpy.ops.mesh.primitive_cone_add(vertices=3, radius1=radius, radius2=0, depth=depth)
    ob = bpy.context.object
    ob.name = name
    ob.location = pos
    ob.data.materials.append(mat)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bind(ob, bone)
    return ob


def make_curve(name, points, colour, bone, thickness=.034):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 16
    curve.bevel_depth = thickness
    curve.bevel_resolution = 2
    poly = curve.splines.new("POLY")
    poly.points.add(len(points) - 1)
    for p, xyz in zip(poly.points, points):
        p.co = (*xyz, 1)
    ob = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(ob)
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.convert(target="MESH")
    ob = bpy.context.object
    ob.data.materials.append(colour)
    bind(ob, bone)
    return ob


def bind(ob, bone):
    # Rigid weight per anatomical part. This creates an actual skinned glTF
    # skeleton, but is not a continuous deformable fur/skin mesh yet.
    group = ob.vertex_groups.new(name=bone)
    group.add(list(range(len(ob.data.vertices))), 1.0, "REPLACE")
    modifier = ob.modifiers.new("Calico armature", "ARMATURE")
    modifier.object = RIG
    ob.parent = RIG


def smoothstep(edge0, edge1, value):
    """Clamped smooth blending, no discontinuous weight bands."""
    t = max(0.0, min(1.0, (value-edge0)/(edge1-edge0)))
    return t*t*(3.0-2.0*t)


def soften_skin(ob, primary, secondary, secondary_fraction):
    """Deform one contiguous mesh with two connected anatomical bones.

    Rigid submeshes are still used for ears/nose/whiskers, but torso, ruff,
    face and limb surfaces now have interpolated skin weights. This does not
    claim that overlapping surfaces are one watertight character sculpt.
    """
    first = ob.vertex_groups.get(primary)
    if first is None:
        raise RuntimeError("Missing skin bone %s on %s" % (primary, ob.name))
    second = ob.vertex_groups.new(name=secondary)
    for vertex in ob.data.vertices:
        blend = max(0.0, min(0.88, float(secondary_fraction(vertex.co))))
        if blend > .0001:
            first.add([vertex.index], max(.0001, 1.0-blend), "REPLACE")
            second.add([vertex.index], blend, "REPLACE")
    return ob


def vertex_contact(meshes):
    """Minimum world-space paw sole height with all armature deformers applied."""
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    lows = []
    for ob in meshes:
        evaluated = ob.evaluated_get(depsgraph)
        evaluated_mesh = evaluated.to_mesh()
        try:
            world = evaluated.matrix_world
            lows.append(min((world @ v.co).z for v in evaluated_mesh.vertices))
        finally:
            evaluated.to_mesh_clear()
    return min(lows)


def plant_feet(frame, paw_meshes, target_z=.012):
    """Correct body root height from *evaluated skinned paw geometry*.

    This corrects actual contact, not an abstract sine curve. Paw swing
    remains authored by the gait and is not an active collision solver.
    """
    bpy.context.scene.frame_set(frame)
    low = vertex_contact(paw_meshes)
    # A fully posed leg can shift by more than 34 cm at an extreme
    # gait pose; use the measured sole discrepancy rather than truncating it.
    correction = max(-.85, min(.85, target_z-low))
    root = RIG.pose.bones["Root"]
    root.location.z += correction
    root.keyframe_insert("location", frame=frame, group="Root")
    # Force Blender's armature modifier to rebuild at a neighbouring time,
    # then sample the authored key again; a same-frame refresh can use the
    # previously cached deformed mesh in Blender 4.0 headless evaluation.
    bpy.context.scene.frame_set(frame + 1)
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    actual = vertex_contact(paw_meshes)
    if frame in (1, 17, 49):
        print("PAW_CONTACT frame=%d before=%.4f correction=%.4f after=%.4f root=%.4f" %
              (frame, low, correction, actual, root.location.z), flush=True)
    if abs(actual-target_z) > .028:
        raise RuntimeError("Foot contact correction failed at %s: %.3fm" % (frame, actual))


def shape_target(ob, name, scale_z):
    ob.shape_key_add(name="Basis")
    key = ob.shape_key_add(name=name)
    for src, dst in zip(ob.data.shape_keys.key_blocks["Basis"].data, key.data):
        dst.co = (src.co.x, src.co.y, src.co.z * scale_z)
    return key


def skeleton():
    global RIG
    arm = bpy.data.armatures.new("NuzzleCalicoSkeleton")
    RIG = bpy.data.objects.new("NuzzleCalicoArmature", arm)
    bpy.context.collection.objects.link(RIG)
    bpy.context.view_layer.objects.active = RIG
    RIG.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bones = {
        "Root": (None, (0, -.3, .25), (0, -.3, .57)),
        "Body": ("Root", (0, -.3, .57), (0, -.3, 1.05)),
        "Neck": ("Body", (0, .22, 1.05), (0, .42, 1.38)),
        "Head": ("Neck", (0, .42, 1.38), (0, .46, 1.91)),
        "Jaw": ("Head", (0, 1.04, 1.33), (0, 1.11, 1.12)),
        "Tongue": ("Jaw", (0, 1.13, 1.26), (0, 1.23, 1.20)),
        "Ear_L": ("Head", (-.45, .40, 1.99), (-.47, .42, 2.30)),
        "Ear_R": ("Head", (.45, .40, 1.99), (.47, .42, 2.30)),
        "Tail_1": ("Body", (0, -.92, .88), (0, -1.16, 1.04)),
        "Tail_2": ("Tail_1", (0, -1.16, 1.04), (0, -1.35, 1.36)),
    }
    # Front and rear legs are true two-link bone chains; the foot targets are
    # computed by two-bone IK in the authoring walk cycle below.
    for fore in (True, False):
        y = .33 if fore else -.69
        z = 1.02 if fore else .89
        for side in (-1, 1):
            label = ("Front" if fore else "Rear") + ("_L" if side < 0 else "_R")
            x = side * .46
            bones[label + "_Upper"] = ("Body", (x, y, z), (x, y, z - .43))
            bones[label + "_Lower"] = (label + "_Upper", (x, y, z - .43), (x, y, z - .89))
    for name, (parent, head, tail) in bones.items():
        edit = arm.edit_bones.new(name)
        edit.head = head
        edit.tail = tail
        if parent:
            edit.parent = arm.edit_bones[parent]
            edit.use_connect = False
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="DESELECT")
    for p in RIG.pose.bones:
        p.rotation_mode = "XYZ"
    return RIG


def model():
    cream = material("Calico ivory fur", (.93, .87, .75))
    white = material("Face cream", (1, .956, .87))
    gold = material("Calico amber", (.94, .60, .26))
    cocoa = material("Calico chocolate", (.39, .22, .17))
    blush = material("Calico cheeks", (1, .69, .66))
    pink = material("Ear and paw pink", (.98, .56, .58))
    nose = material("Little coral nose", (.98, .28, .32))
    dark = material("Eye and mouth cocoa", (.19, .10, .095), .62)
    mouth_red = material("Open mouth ruby", (.65, .13, .16))
    body = make_mesh("Continuous chibi torso", (0, -.26, .96), (.64, .83, .59), cream, "Body", 64, 40)
    soften_skin(body, "Body", "Neck", lambda v:
                .48 * smoothstep(.02,.58,v.y) * smoothstep(.78,1.39,v.z))
    body.data.materials.append(gold)
    for polygon in body.data.polygons:
        points = [body.data.vertices[i].co for i in polygon.vertices]
        avg = sum(points, Vector()) / len(points)
        if avg.x > .43 and -.72 < avg.y < .15 and avg.z < 1.23:
            polygon.material_index = 1
    ruff = make_mesh("Cream fluffy ruff", (0, .14, 1.12),
                     (.57, .45, .48), white, "Neck", 40, 28)
    soften_skin(ruff, "Neck", "Body", lambda v:
                .72 * (1-smoothstep(.81,1.27,v.z)))
    # Painted calico forehead and ears carry the distinct original markings.
    make_mesh("Soft belly", (0, .36, .82), (.43, .29, .37), white, "Body")
    face = make_mesh("One-piece calico rounded face", (0, .53, 1.60),
                     (.76, .59, .64), white, "Head", 128, 88)
    soften_skin(face, "Head", "Neck", lambda v:
                .40 * (1-smoothstep(.97,1.42,v.z))
                * (1-smoothstep(.58,1.10,v.y)))
    # Real surface paint zones rather than floating sphere patches. Geometry
    # remains continuous so forehead markings follow all head rotations.
    face.data.materials.append(gold)
    face.data.materials.append(cocoa)
    for polygon in face.data.polygons:
        verts = [face.data.vertices[i].co for i in polygon.vertices]
        avg = sum(verts, Vector()) / len(verts)
        wave = .04 * math.sin(avg.x * 15) + .025 * math.sin(avg.y * 13)
        if avg.z > 1.79 + wave and avg.y > .25:
            # Camera faces the character from +Y, so +X is screen-left.
            if avg.x > .035:
                polygon.material_index = 1
            elif avg.x < -.05:
                polygon.material_index = 2
    make_cone("Screen-left amber ear", (.50, .45, 2.18), .30, .61, gold, "Ear_R")
    make_cone("Screen-right chocolate ear", (-.50, .45, 2.18), .30, .61, cocoa, "Ear_L")
    make_cone("Screen-left rose ear inset", (.50, .67, 2.17), .16, .38, pink, "Ear_R")
    make_cone("Screen-right rose ear inset", (-.50, .67, 2.17), .16, .38, pink, "Ear_L")
    make_mesh("Left rose cheek", (-.47, 1.04, 1.44), (.19, .055, .12), blush, "Head")
    make_mesh("Right rose cheek", (.47, 1.04, 1.44), (.19, .055, .12), blush, "Head")
    make_mesh("Left muzzle", (-.16, 1.08, 1.30), (.23, .13, .18), white, "Head")
    make_mesh("Right muzzle", (.16, 1.08, 1.30), (.23, .13, .18), white, "Head")
    make_mesh("Heart shaped coral nose", (0, 1.23, 1.46), (.10, .06, .065), nose, "Head")
    mouth = make_mesh("Dark living mouth", (0, 1.10, 1.18), (.22, .055, .17), mouth_red, "Jaw")
    shape_target(mouth, "Jaw_Open", 1.43)
    tongue = make_mesh("Licking pink tongue", (0, 1.166, 1.14), (.145, .035, .072), pink, "Tongue")
    shape_target(tongue, "Lick", 1.60)
    for side in (-1, 1):
        pos = "L" if side < 0 else "R"
        # Distinct eyes instead of permanently painted arcs. The eyeballs
        # deform with Blink shape keys; the raised smile lids preserve art style.
        eye = make_mesh("%s deep cocoa eye" % pos, (side*.30, 1.038, 1.75),
                        (.11, .042, .045), dark, "Head", 24, 16)
        shape_target(eye, "Blink_" + pos, .12)
        # Additional shape key for exaggerated curiosity.
        key = eye.shape_key_add(name="Eye_Wide")
        for src, dst in zip(eye.data.shape_keys.key_blocks["Basis"].data, key.data):
            dst.co = (src.co.x, src.co.y, src.co.z * 4.2)
        # Upper smiling eyelid arc
        points = []
        for i in range(11):
            angle = math.pi * i / 10
            points.append((side*.30 + .145*math.cos(angle),
                           1.092, 1.76 + .09*math.sin(angle)))
        make_curve("%s smiling lid" % pos, points, cocoa, "Head", .031)
        for whisker in range(3):
            start_x = side*.61
            end_x = side*(.90 + whisker*.035)
            z = 1.33 + (whisker-1)*.10
            make_curve("%s whisker %s" % (pos, whisker),
                       [(start_x, 1.025, 1.33), (end_x, .94, z)],
                       cocoa, "Head", .014)
    for fore in (True, False):
        y = .33 if fore else -.69
        z = 1.02 if fore else .89
        for side in (-1, 1):
            label = ("Front" if fore else "Rear") + ("_L" if side < 0 else "_R")
            x = side*.46
            shoulder = make_mesh(label + " shoulder", (x,y,z-.25),
                                 (.23,.27,.38), cream, label + "_Upper", 32,22)
            soften_skin(shoulder, label+"_Upper", "Body", lambda v, upper_z=z:
                        .67*smoothstep(upper_z-.32, upper_z+.12, v.z))
            lower_paw = make_mesh(label + " lower paw", (x,y,z-.68),
                                  (.19,.24,.27), cream, label + "_Lower", 32,20)
            soften_skin(lower_paw, label+"_Lower", label+"_Upper",
                        lambda v, lower_z=z-.68:
                        .59*smoothstep(lower_z-.12, lower_z+.28, v.z))
            make_mesh(label + " rosy toe pad", (x,y+.20,.18), (.12,.035,.08),
                      pink, label + "_Lower", 16,12)
    make_mesh("Amber tail base", (0,-1.14,.99), (.23,.40,.22), gold, "Tail_1")
    make_mesh("Dark tipped tail", (0,-1.35,1.28), (.24,.29,.23), cocoa, "Tail_2")
    # Add an independent little whisker/tongue/mouth assembly through the rig.
    # This rig is intentionally visually recognisable but is not a scanned pet.


def set_pose(frame, *, root_y=0, root_z=0, body_z=0, body_pitch=0,
             head_pitch=0, head_yaw=0, head_drop=0, head_reach=0, jaw=0, tongue=0, tail=0,
             ears=0, legs=None):
    for pb in RIG.pose.bones:
        pb.location = (0, 0, 0)
        pb.rotation_euler = (0, 0, 0)
    # Set the resting sole just above the ground instead of hovering.
    RIG.pose.bones["Root"].location = (0, root_y, root_z - .12)
    RIG.pose.bones["Body"].location.z = body_z
    RIG.pose.bones["Body"].rotation_euler.x = body_pitch
    RIG.pose.bones["Head"].rotation_euler.x = head_pitch
    RIG.pose.bones["Head"].location.z = -head_drop
    RIG.pose.bones["Head"].location.y = head_reach
    RIG.pose.bones["Head"].rotation_euler.z = head_yaw
    RIG.pose.bones["Jaw"].rotation_euler.x = jaw
    RIG.pose.bones["Tongue"].location.y = tongue
    RIG.pose.bones["Tail_1"].rotation_euler.z = tail
    RIG.pose.bones["Tail_2"].rotation_euler.x = .20 * math.sin(frame*.12)
    RIG.pose.bones["Ear_L"].rotation_euler.y = ears
    RIG.pose.bones["Ear_R"].rotation_euler.y = -ears
    if legs:
        for name, (upper, lower) in legs.items():
            RIG.pose.bones[name+"_Upper"].rotation_euler.x = upper
            RIG.pose.bones[name+"_Lower"].rotation_euler.x = lower
    for pb in RIG.pose.bones:
        pb.keyframe_insert("location", frame=frame, group=pb.name)
        pb.keyframe_insert("rotation_euler", frame=frame, group=pb.name)


def gait_ik(phase, is_front):
    # Stance -> plant (negative Z travel), swing -> lifted forward paw.
    phase = phase % 1
    foot_y = .16 - .32*phase if phase < .60 else -.16 + .32*(phase-.60)/.40
    lift = 0 if phase < .60 else .12 * math.sin(math.pi*(phase-.60)/.40)
    drop = .81 if is_front else .69
    dy = foot_y
    dz = -drop + lift
    l1,l2 = .43,.46
    d = max(.08,min(l1+l2-.001,math.hypot(dy,dz)))
    first = math.atan2(dy,-dz) - math.acos(max(-1,min(1,(l1*l1+d*d-l2*l2)/(2*l1*d))))
    second = math.pi-math.acos(max(-1,min(1,(l1*l1+l2*l2-d*d)/(2*l1*l2))))
    return (first, second)


def build_actions():
    paw_meshes = [ob for ob in bpy.context.scene.objects
                  if ob.type=="MESH" and " lower paw" in ob.name]
    if len(paw_meshes) != 4:
        raise RuntimeError("Exactly four deformable paws required for contact QA")
    RIG.animation_data_create()
    for clip in ("Idle","Walk","Eat","Play","Rest"):
        action = bpy.data.actions.new(clip)
        RIG.animation_data.action = action
        for frame in range(1, LAST+1, 4):
            t = (frame-1)/(LAST-1)
            cycle = 2*math.pi*t
            if clip == "Walk":
                legs = {}
                for fore in (True, False):
                    for side in (-1,1):
                        label = ("Front" if fore else "Rear") + ("_L" if side < 0 else "_R")
                        # Diagonal pair gait, with a consistent foot-plant interval.
                        phase = (2*t + (.5 if (fore == (side < 0)) else 0)) % 1
                        legs[label] = gait_ik(phase, fore)
                set_pose(frame, root_z=.024*abs(math.sin(cycle*2)), body_z=.02,
                         body_pitch=.03*math.sin(cycle*2), head_pitch=-.04,
                         tail=.15*math.sin(cycle), legs=legs)
            elif clip == "Eat":
                bite = max(0, math.sin(cycle*5))
                # Two-stage feeding action: lower head and reach, then chew/lick.
                approach = min(1, max(0,(frame-1)/10), max(0,(LAST-frame)/10))
                set_pose(frame, head_pitch=-.54*approach,
                         head_drop=.74*approach, head_reach=.17*approach,
                         body_pitch=-.12*approach,
                         jaw=.32*bite*approach,
                         tongue=.14*max(0,math.sin(cycle*4))*approach,
                         tail=.05*math.sin(cycle))
            elif clip == "Play":
                set_pose(frame, root_z=.07*abs(math.sin(cycle*2)),
                         body_pitch=.09*math.sin(cycle), head_pitch=-.12,
                         head_yaw=.13*math.sin(cycle), tail=.26*math.sin(cycle*2),
                         ears=.05*math.sin(cycle*2))
            elif clip == "Rest":
                set_pose(frame, body_z=-.24, head_pitch=.18,
                         tail=.09*math.sin(cycle))
            else:
                set_pose(frame, body_z=.016*math.sin(cycle),
                         head_yaw=.07*math.sin(cycle), head_pitch=.03*math.sin(cycle),
                         tail=.14*math.sin(cycle), ears=.035*math.sin(cycle))
            plant_feet(frame, paw_meshes)
        # Frame LAST is already authored in the above loop at the same
        # walk-cycle phase as frame 1. Never overwrite it with neutral limbs:
        # that introduces a visible gait/feeding snap at the loop seam.
        RIG.animation_data.action = None
        track = RIG.animation_data.nla_tracks.new()
        track.name = clip
        strip = track.strips.new(clip, 1, action)
        strip.action_frame_start = 1
        strip.action_frame_end = LAST
        strip.blend_type = "REPLACE"
        track.mute = True
    # For the glTF exporter NLA tracks are unmuted; the Action slot is empty.
    for track in RIG.animation_data.nla_tracks:
        track.mute = False


def main():
    args = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", required=True)
    options = parser.parse_args(args)
    out = Path(options.output_dir).resolve()
    out.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.context.scene.render.fps = FPS
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = LAST
    skeleton()
    model()
    build_actions()
    bpy.context.scene.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=str(out/"nuzzle-calico-rig.blend"))
    bpy.ops.object.select_all(action="DESELECT")
    for ob in bpy.context.scene.objects:
        if ob.type in {"MESH","ARMATURE"}:
            ob.select_set(True)
    bpy.context.view_layer.objects.active = RIG
    kwargs = dict(
        filepath=str(out/"nuzzle-calico-rig.glb"),
        export_format="GLB",
        export_animations=True,
        export_nla_strips=True,
        export_materials="EXPORT",
        export_yup=True,
    )
    # Blender versions differ in glTF animation settings.
    bpy.ops.export_scene.gltf(**kwargs)
    glb = out/"nuzzle-calico-rig.glb"
    if not glb.is_file() or glb.stat().st_size > 8*1024*1024:
        raise RuntimeError("Candidate GLB absent or over mobile budget")
    manifest = dict(
        model="Nuzzle original calico candidate",
        status="UNAPPROVED",
        source="public/animals/cat.webp (style reference only)",
        blender=bpy.app.version_string,
        clips=["Idle","Walk","Eat","Play","Rest"],
        rig="Skin-weighted neck, torso, head and limbs; two-link foot gait with evaluated paw contact",
        physics="Per-keyframe evaluated paw sole corrections; secondary motion approximate; no rigid-body muscle simulation",
        sha256=hashlib.sha256(glb.read_bytes()).hexdigest(),
        bytes=glb.stat().st_size,
    )
    (out/"nuzzle-calico-rig.json").write_text(json.dumps(manifest,indent=2)+"\n")
    print("CALICO-CANDIDATE: "+json.dumps(manifest))


if __name__=="__main__":
    main()
