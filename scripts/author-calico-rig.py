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

sys.path.insert(0, str(Path(__file__).resolve().parent))
from calico_gait import root_height, walk_leg_pose, groom_paw_pose

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
    """Build a thin, swept triangular feline ear instead of a round cone.

    The broad base follows the skull and the slanted tip points outward.
    Front and back faces give this genuinely three-dimensional ear a little
    thickness without introducing a heavy cartoon traffic-cone silhouette.
    """
    x, y, z = pos
    outward = 1 if x > 0 else -1
    base_z = z - depth*.39
    tip_z = z + depth*.56
    pts = [
        (x-radius*.90, y+.05, base_z),
        (x+radius*.90, y+.05, base_z),
        (x+outward*radius*.18, y-.015, tip_z),
        (x-radius*.90, y-.10, base_z),
        (x+radius*.90, y-.10, base_z),
        (x+outward*radius*.18, y-.11, tip_z),
    ]
    faces = [(0,1,2), (5,4,3), (0,3,4,1),
             (1,4,5,2), (2,5,3,0)]
    mesh = bpy.data.meshes.new(name + " ear geometry")
    mesh.from_pydata(pts, [], faces)
    mesh.update()
    ob = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(ob)
    ob.data.materials.append(mat)
    bind(ob, bone)
    return ob


def make_curve(name, points, colour, bone, thickness=.034):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 16
    curve.bevel_depth = thickness
    curve.bevel_resolution = 2
    curve.use_fill_caps = True
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


def shape_target(ob, name, scale_z):
    """Animate expression thickness around the local mesh centre, not world Z.

    The old implementation multiplied absolute positions; Blink moved eyes
    from face height to the cat's feet, and Eye_Wide could fly off the skull.
    """
    ob.shape_key_add(name="Basis")
    key = ob.shape_key_add(name=name)
    basis = ob.data.shape_keys.key_blocks["Basis"].data
    centre_z = .5*(min(v.co.z for v in basis)+max(v.co.z for v in basis))
    for src, dst in zip(basis, key.data):
        dst.co = (src.co.x, src.co.y,
                  centre_z+(src.co.z-centre_z)*scale_z)
    return key


def verify_expression_shapes():
    """Block escaped/teleported blend shapes before exporting mobile GLB."""
    checked = []
    for ob in bpy.data.objects:
        if ob.type != "MESH" or ob.data.shape_keys is None:
            continue
        keys = ob.data.shape_keys.key_blocks
        if len(keys) < 2:
            continue
        basis = keys[0].data
        for key in list(keys)[1:]:
            motion = max((vertex.co-other.co).length
                         for other,vertex in zip(basis,key.data))
            if not math.isfinite(motion) or motion > .20:
                raise RuntimeError(
                    "Facial shape %s on %s moves %.3fm from its mesh" %
                    (key.name, ob.name, motion)
                )
            checked.append((ob.name,key.name,round(motion,4)))
    if len(checked) < 8:
        raise RuntimeError("Expected all original expressions after sculpt refinement")
    print("FACE_MORPH_BUDGET: %s" % json.dumps(checked), flush=True)


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
                     (.71, .57, .60), white, "Head", 128, 88)
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
    make_cone("Screen-left rose ear inset", (.50, .52, 2.20), .15, .36, pink, "Ear_R")
    make_cone("Screen-right rose ear inset", (-.50, .52, 2.20), .15, .36, pink, "Ear_L")
    for side, label in ((-1, "Left"), (1, "Right")):
        cheek = make_mesh(label+" rose cheek", (side*.44, 1.032, 1.45),
                          (.155, .035, .09), blush, "Head")
        cheek.shape_key_add(name="Basis")
        puff = cheek.shape_key_add(name="Cheek_Puff")
        for source, vertex in zip(cheek.data.shape_keys.key_blocks["Basis"].data, puff.data):
            vertex.co = (source.co.x + side*.034,
                         source.co.y + .022, source.co.z + .012)
    make_mesh("Left muzzle", (-.15, 1.08, 1.31), (.205, .12, .145), white, "Head")
    make_mesh("Right muzzle", (.15, 1.08, 1.31), (.205, .12, .145), white, "Head")
    nose_mesh = make_mesh("Heart shaped coral nose", (0, 1.23, 1.46),
                          (.10, .06, .065), nose, "Head")
    nose_mesh.shape_key_add(name="Basis")
    sniff = nose_mesh.shape_key_add(name="Sniff")
    for source, vertex in zip(nose_mesh.data.shape_keys.key_blocks["Basis"].data, sniff.data):
        vertex.co = (source.co.x*1.18, source.co.y+.018, 1.46+(source.co.z-1.46)*1.09)
    mouth = make_mesh("Dark living mouth", (0, 1.10, 1.18), (.22, .055, .17), mouth_red, "Jaw")
    shape_target(mouth, "Jaw_Open", 1.43)
    smile = mouth.shape_key_add(name="Smile")
    for source, vertex in zip(mouth.data.shape_keys.key_blocks["Basis"].data, smile.data):
        bend = min(1.0, abs(source.co.x)/.21)
        vertex.co = (source.co.x*1.09, source.co.y, source.co.z+.052*bend)
    tongue = make_mesh("Licking pink tongue", (0, 1.166, 1.14), (.145, .035, .072), pink, "Tongue")
    shape_target(tongue, "Lick", 1.60)
    for side in (-1, 1):
        pos = "L" if side < 0 else "R"
        # Distinct eyes instead of permanently painted arcs. The eyeballs
        # deform with Blink shape keys; the raised smile lids preserve art style.
        eye = make_mesh("%s deep cocoa eye" % pos, (side*.29, 1.105, 1.74),
                        (.105, .055, .090), dark, "Head", 24, 16)
        shape_target(eye, "Blink_" + pos, .12)
        # Additional shape key for exaggerated curiosity.
        key = eye.shape_key_add(name="Eye_Wide")
        for src, dst in zip(eye.data.shape_keys.key_blocks["Basis"].data, key.data):
            dst.co = (src.co.x, src.co.y, 1.74+(src.co.z-1.74)*1.85)
        # Upper smiling eyelid arc
        points = []
        for i in range(11):
            angle = math.pi * i / 10
            points.append((side*.29 + .125*math.cos(angle),
                           1.165, 1.795 + .07*math.sin(angle)))
        make_curve("%s smiling lid" % pos, points, cocoa, "Head", .022)
        # Tiny catchlight follows the skull; leave eye blink/curious shapes
        # on the underlying eye mesh, not the reflection.
        make_mesh("%s eye catchlight" % pos,
                  (side*.29-.029, 1.16, 1.775),
                  (.026, .009, .025), white, "Head", 16, 12)
        for whisker in range(3):
            z = 1.34 + (whisker-1)*.12
            make_curve("%s whisker %s" % (pos, whisker),
                       [(side*.47, 1.115, 1.34),
                        (side*.67, 1.14, 1.34+(whisker-1)*.04),
                        (side*(.94 + whisker*.03), 1.08, z)],
                       cocoa, "Head", .007)
    for fore in (True, False):
        y = .33 if fore else -.69
        z = 1.02 if fore else .89
        for side in (-1, 1):
            label = ("Front" if fore else "Rear") + ("_L" if side < 0 else "_R")
            x = side*.46
            shoulder = make_mesh(label + " shoulder", (x,y,z-.25),
                                 (.195,.235,.38), cream, label + "_Upper", 32,22)
            soften_skin(shoulder, label+"_Upper", "Body", lambda v, upper_z=z:
                        .67*smoothstep(upper_z-.32, upper_z+.12, v.z))
            lower_paw = make_mesh(label + " lower paw", (x,y,z-.68),
                                  (.166,.215,.27), cream, label + "_Lower", 32,20)
            soften_skin(lower_paw, label+"_Lower", label+"_Upper",
                        lambda v, lower_z=z-.68:
                        .59*smoothstep(lower_z-.12, lower_z+.28, v.z))
            # Pads belong to each paw's own underside, not a shared absolute
            # world height. The previous z=.18 made rear pads float about 26 cm
            # above the evaluated stance paw despite correct lower-mesh contact.
            # In bind pose the lower paw is centred at z-.68 with radius .27;
            # its sole lies near z-.95. Use fore/hind anatomical offsets,
            # calibrated against the *evaluated* stance and swing pad bounds
            # in the Blender contact-audit report.
            toe_pad = make_mesh(label + " rosy toe pad",
                                (x,y+.19,z-(.89 if fore else .95)), (.12,.035,.08),
                                pink, label + "_Lower", 16,12)
            soften_skin(toe_pad, label+"_Lower", label+"_Upper",
                        lambda v: .13)
    # A continuous-looking curled tail profile, not two disconnected spheres.
    make_curve("Amber tail base", [(0,-.96,.92), (0,-1.11,1.01),
                                  (0,-1.21,1.18)], gold, "Tail_1", .11)
    make_curve("Dark tipped tail", [(0,-1.21,1.18), (0,-1.27,1.31),
                                   (0,-1.22,1.46)], cocoa, "Tail_2", .10)
    # Add an independent little whisker/tongue/mouth assembly through the rig.
    # This rig is intentionally visually recognisable but is not a scanned pet.


def set_pose(frame, *, root_y=0, root_z=0, body_z=0, body_pitch=0,
             head_pitch=0, head_yaw=0, head_drop=0, head_reach=0, jaw=0, tongue=0, tail=0,
             ears=0, legs=None):
    for pb in RIG.pose.bones:
        pb.location = (0, 0, 0)
        pb.rotation_euler = (0, 0, 0)
    # Calibrated resting height from evaluated Blender paw soles at Idle.
    # Collision-aware IK and dynamic foot planting are not yet implemented.
    # Blender pose translation is in BONE-LOCAL coordinates, not world
    # coordinates. Upright Root/Body/Head bones have local +Y along world +Z,
    # while local +Z points roughly toward -world Y. This is why adjusting
    # Root.location.z previously never lifted planted feet off the floor.
    RIG.pose.bones["Root"].location = (0, root_z - .048, -root_y)
    RIG.pose.bones["Body"].location.y = body_z
    RIG.pose.bones["Body"].rotation_euler.x = body_pitch
    RIG.pose.bones["Head"].rotation_euler.x = head_pitch
    RIG.pose.bones["Head"].location.y = -head_drop
    RIG.pose.bones["Head"].location.z = -head_reach
    RIG.pose.bones["Head"].rotation_euler.z = head_yaw
    RIG.pose.bones["Jaw"].rotation_euler.x = jaw
    RIG.pose.bones["Tongue"].location.y = tongue
    RIG.pose.bones["Tail_1"].rotation_euler.z = tail
    RIG.pose.bones["Tail_2"].rotation_euler.x = .20 * math.sin(2*math.pi*(frame-1)/(LAST-1))
    RIG.pose.bones["Ear_L"].rotation_euler.y = ears
    RIG.pose.bones["Ear_R"].rotation_euler.y = -ears
    if legs:
        for name, (upper, lower) in legs.items():
            RIG.pose.bones[name+"_Upper"].rotation_euler.x = upper
            RIG.pose.bones[name+"_Lower"].rotation_euler.x = lower
    for pb in RIG.pose.bones:
        pb.keyframe_insert("location", frame=frame, group=pb.name)
        pb.keyframe_insert("rotation_euler", frame=frame, group=pb.name)


def evaluated_lower_paw_height(label):
    """World-space underside of a live, armature-deformed paw mesh."""
    ob = bpy.data.objects[label + " lower paw"]
    bpy.context.view_layer.update()
    graph = bpy.context.evaluated_depsgraph_get()
    evaluated = ob.evaluated_get(graph)
    mesh = evaluated.to_mesh(preserve_all_data_layers=False, depsgraph=graph)
    try:
        return min((evaluated.matrix_world @ v.co).z for v in mesh.vertices)
    finally:
        evaluated.to_mesh_clear()


def fit_walk_stance(frame, t):
    """Solve stance feet from Blender's *evaluated paw geometry*.

    The analytic IK positions bone tips. Mesh soles do not coincide with those
    tips and were penetrating the floor. Adjust only each planted lower-bone
    offset, measuring the actual deformation derivative numerically.
    The offset is limited to 8 cm to avoid visibly disconnecting the joint.
    This is authored geometry correction, NOT a collision/force simulator.
    """
    for fore in (True, False):
        for side in (-1, 1):
            name = ("Front" if fore else "Rear") + ("_L" if side < 0 else "_R")
            _, _, planted = walk_leg_pose(t, fore, side)
            if not planted:
                continue
            lower = RIG.pose.bones[name + "_Lower"]
            before = evaluated_lower_paw_height(name)
            original = lower.location.y
            probe = .018
            lower.location.y = original + probe
            tested = evaluated_lower_paw_height(name)
            lower.location.y = original
            gradient = (tested-before)/probe
            if not math.isfinite(gradient) or abs(gradient) < .15:
                raise RuntimeError("Cannot solve Blender paw contact: %s at frame %s gradient=%s" %
                                   (name, frame, gradient))
            correction = max(-.08, min(.08, (.006-before)/gradient))
            lower.location.y = original + correction
            lower.keyframe_insert("location", frame=frame, group=lower.name)
            actual = evaluated_lower_paw_height(name)
            if abs(actual-.006) > .025:
                raise RuntimeError("Stance paw did not converge: %s frame %s before %.4f after %.4f" %
                                   (name, frame, before, actual))
            if frame in (1, 13, 25, 37, 49):
                print("STANCE_CONTACT name=%s frame=%d before=%.4f after=%.4f" %
                      (name, frame, before, actual), flush=True)


def evaluated_mesh_centre(name):
    """Axis-aligned centre of an armature-deformed mesh in world space."""
    ob = bpy.data.objects[name]
    bpy.context.view_layer.update()
    graph = bpy.context.evaluated_depsgraph_get()
    active = ob.evaluated_get(graph)
    mesh = active.to_mesh(preserve_all_data_layers=False, depsgraph=graph)
    try:
        points = [active.matrix_world @ vertex.co for vertex in mesh.vertices]
        return Vector(tuple(
            .5*(min(p[axis] for p in points)+max(p[axis] for p in points))
            for axis in range(3)
        ))
    finally:
        active.to_mesh_clear()


def aim_grooming_forepaw(frame, reach):
    """Damped Blender-space contact fitting for the raised grooming paw.

    Armature local axes differ from world axes. Solve their real 3D Jacobian
    numerically on the evaluated skin rather than assuming Blender bone .z
    means up. Split movement between the shoulder and forearm to avoid an
    extreme elbow offset. Still kinematic, not collision-aware physics.
    """
    if reach < .02:
        return
    paw_name = "Front_L lower paw"
    muzzle_name = "Left muzzle"
    current = evaluated_mesh_centre(paw_name)
    muzzle = evaluated_mesh_centre(muzzle_name)
    delta = (muzzle-current)*reach

    # Do most of the reachable movement at the shoulder, then finish using
    # the forearm. Keep corrections bounded to preserve anatomy in the
    # stylized character and fail rather than silently emit a bad key pose.
    for bone_name, fraction, limit in (
        ("Front_L_Upper", .54, .21),
        ("Front_L_Lower", 1., .24),
    ):
        pb = RIG.pose.bones[bone_name]
        before = evaluated_mesh_centre(paw_name)
        residual = muzzle-before
        if bone_name.endswith("_Upper"):
            residual *= fraction*reach
        else:
            residual *= reach
        columns = []
        step = .012
        for axis in range(3):
            original = tuple(pb.location)
            coords = list(original)
            coords[axis] += step
            pb.location = coords
            after = evaluated_mesh_centre(paw_name)
            columns.append((after-before)/step)
            pb.location = original
        jac = __import__("mathutils").Matrix((
            (columns[0].x, columns[1].x, columns[2].x),
            (columns[0].y, columns[1].y, columns[2].y),
            (columns[0].z, columns[1].z, columns[2].z),
        ))
        if abs(jac.determinant()) < .05:
            raise RuntimeError("Grooming paw Jacobian is singular at frame %d" % frame)
        move = jac.inverted() @ residual
        pb.location = tuple(max(-limit,min(limit,float(value))) for value in move)
        pb.keyframe_insert("location", frame=frame, group=pb.name)
    after = evaluated_mesh_centre(paw_name)
    gap = (after-muzzle).length
    if reach >= .92 and gap > .15:
        raise RuntimeError("Grooming paw missed muzzle by %.3f m at %d" % (gap,frame))
    if frame in (13, 19, 25, 31, 37):
        print("GROOM_CONTACT frame=%d reach=%.2f before=%.3f after=%.3f" %
              (frame, reach, (current-muzzle).length, gap),flush=True)


def build_actions():
    RIG.animation_data_create()
    for clip in ("Idle","Walk","Eat","Play","Rest","Groom","Sniff"):
        action = bpy.data.actions.new(clip)
        RIG.animation_data.action = action
        for frame in range(1, LAST+1, 2):
            t = (frame-1)/(LAST-1)
            cycle = 2*math.pi*t
            if clip == "Walk":
                legs = {}
                for fore in (True, False):
                    for side in (-1,1):
                        label = ("Front" if fore else "Rear") + ("_L" if side < 0 else "_R")
                        legs[label] = walk_leg_pose(t, fore, side)[0]
                # Hold a mathematical shin-tip target over stance and lift it
                # over swing. The root bobs but does not translate in world
                # space; actual floor/mesh collisions still need refinement.
                set_pose(frame, root_z=root_height(t)+.048,
                         head_pitch=-.035*math.sin(cycle*2),
                         tail=.16*math.sin(cycle), legs=legs)
                fit_walk_stance(frame, t)
            elif clip == "Eat":
                bite = max(0, math.sin(cycle*5))
                # Two-stage feeding action: lower head and reach, then chew/lick.
                approach = smoothstep(0, 1, min(1,max(0,(frame-1)/12),max(0,(LAST-frame)/12)))
                set_pose(frame, head_pitch=-.54*approach,
                         head_drop=.42*approach, head_reach=.17*approach,
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
            elif clip == "Groom":
                # Lift one paw toward the face, tilt the head, lick, reset.
                # Deliberately kinematic; future IK should solve true paw contact.
                reach = math.sin(math.pi*t)**2
                lick = max(0.0, math.sin(cycle*5))
                set_pose(frame, body_z=-.025*reach, head_pitch=-.17*reach,
                         head_yaw=-.27*reach, head_drop=.095*reach,
                         jaw=.16*lick*reach, tongue=.13*lick*reach,
                         tail=.09*math.sin(cycle),
                         legs={"Front_L":groom_paw_pose(reach)})
                aim_grooming_forepaw(frame, reach)
            elif clip == "Sniff":
                # Gentle nose-first inspection with small ear/head movement.
                reach = math.sin(math.pi*t)**2
                set_pose(frame, head_pitch=-.12*reach,
                         head_yaw=.13*math.sin(cycle),
                         head_reach=.085*reach, head_drop=.07*reach,
                         ears=.095*math.sin(cycle*2), tail=.12*math.sin(cycle))
            else:
                set_pose(frame, body_z=.016*math.sin(cycle),
                         head_yaw=.07*math.sin(cycle), head_pitch=.03*math.sin(cycle),
                         tail=.14*math.sin(cycle), ears=.035*math.sin(cycle))
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
    verify_expression_shapes()
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
        clips=["Idle","Walk","Eat","Play","Rest","Groom","Sniff"],
        rig="Skin-weighted neck, torso, head and limbs; two-link kinematic gait",
        physics="Two-link IK, evaluated paw-ground and grooming-target fitting; no dynamic collision or muscle simulation",
        sha256=hashlib.sha256(glb.read_bytes()).hexdigest(),
        bytes=glb.stat().st_size,
    )
    (out/"nuzzle-calico-rig.json").write_text(json.dumps(manifest,indent=2)+"\n")
    print("CALICO-CANDIDATE: "+json.dumps(manifest))


if __name__=="__main__":
    main()
