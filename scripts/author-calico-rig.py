"""Author an original, manually reviewable, skeletal 3D calico in Blender.

Requires Blender bpy + glTF exporter; no paid API, external models or user photos.
This is a *candidate*, never an automatically approved production GLB.
Usage: blender -b -t 2 --python-exit-code 1 --python scripts/author-calico-rig.py -- --output-dir /tmp/calico
"""
import argparse
import hashlib
import json
import math
import struct
import sys
import zlib
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from calico_gait import root_height, walk_leg_pose, groom_paw_pose, walk_weight_shift
from calico_feline_sculpt import apply_sculpt, torso_position, skull_position, toe_position

FPS = 24
LAST = 49



# A single tiny, baked tangent-space normal image is shared by every coat
# material. Blender's procedural nodes do not survive glTF export, so material
# noise without this bake looked flat in the real Three.js viewer.
FUR_NORMAL_IMAGE = None


def prepare_fur_normals(output_dir, size=256):
    """Exportable short-fur bump detail; no translucent hair cards or uploads.

    Tileable value-noise gradients emulate subtle directional fur combing.
    This is explicitly a shading approximation, not simulated strand dynamics.
    """
    global FUR_NORMAL_IMAGE

    def seed(x, y):
        n = ((x * 73856093) ^ (y * 19349663)) & 0xffffffff
        n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
        return n / 4294967295

    def noise(u, v, scale_u, scale_v):
        x, y = u * scale_u, v * scale_v
        ix, iy = math.floor(x), math.floor(y)
        a, b = x-ix, y-iy
        a, b = a*a*(3-2*a), b*b*(3-2*b)
        # Wrap lattice samples to prevent seams in tiled coat normal maps.
        v0 = seed(ix % scale_u, iy % scale_v)*(1-a) + seed((ix+1) % scale_u, iy % scale_v)*a
        v1 = seed(ix % scale_u, (iy+1) % scale_v)*(1-a) + seed((ix+1) % scale_u, (iy+1) % scale_v)*a
        return v0*(1-b)+v1*b

    def relief(x, y):
        # Anisotropic strokes with finer undercoat variation.
        u, v = x / size, y / size
        return (.64*noise(u, v, 74, 166) +
                .26*noise(u, v, 142, 222) +
                .10*noise(u, v, 34, 58))

    # Image.pixels.foreach_set + Image.save sometimes writes a black PNG.
    # Generate deterministic PNG bytes directly, reload and pack into GLB.
    data = bytearray()
    reds, greens = [], []
    for y in range(size):
        data.append(0)  # PNG scanline filter: none
        for x in range(size):
            dx = relief((x+1)%size,y) - relief((x-1)%size,y)
            dy = relief(x,(y+1)%size) - relief(x,(y-1)%size)
            n = Vector((-.32*dx,-.32*dy,1)).normalized()
            colour = (round(255*(.5+.5*n.x)),
                      round(255*(.5+.5*n.y)),
                      round(255*(.5+.5*n.z)),255)
            reds.append(colour[0])
            greens.append(colour[1])
            data.extend(colour)
    r_span, g_span = max(reds)-min(reds), max(greens)-min(greens)
    if min(r_span, g_span) < 10:
        raise RuntimeError("Fur atlas is flat: red=%s green=%s" % (r_span,g_span))

    def chunk(kind, payload):
        raw = kind + payload
        return (struct.pack(">I",len(payload)) + raw +
                struct.pack(">I",zlib.crc32(raw)&0xffffffff))

    png = (b"\x89PNG\r\n\x1a\n" +
           chunk(b"IHDR",struct.pack(">IIBBBBB",size,size,8,6,0,0,0)) +
           chunk(b"IDAT",zlib.compress(bytes(data),9)) +
           chunk(b"IEND",b""))
    path = output_dir / "calico-short-fur-normal.png"
    path.write_bytes(png)
    if len(png)<2500:
        raise RuntimeError("Fur normal PNG is suspiciously small")
    img = bpy.data.images.load(str(path),check_existing=False)
    img.colorspace_settings.name = "Non-Color"
    img.pack()
    FUR_NORMAL_IMAGE = img
    print("FUR_NORMAL_BAKED path=%s red_range=%s green_range=%s bytes=%s" %
          (path,r_span,g_span,len(png)),flush=True)

def material(name, rgb, roughness=0.83):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*rgb, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    # Tangent normal maps are glTF-compatible and preserve per-face calico paint.
    # Other surfaces (eyes, cheeks, pink nose and mouth) stay smooth.
    if FUR_NORMAL_IMAGE and name in {
        "Calico ivory fur", "Face cream", "Calico amber", "Calico chocolate"
    }:
        tex = m.node_tree.nodes.new("ShaderNodeTexImage")
        tex.name = "Exportable short-coat normals"
        tex.image = FUR_NORMAL_IMAGE
        tex.extension = "REPEAT"
        normal = m.node_tree.nodes.new("ShaderNodeNormalMap")
        normal.inputs["Strength"].default_value = .24
        m.node_tree.links.new(tex.outputs["Color"], normal.inputs["Color"])
        m.node_tree.links.new(normal.outputs["Normal"], bsdf.inputs["Normal"])
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
    """A cupped, softly curved feline pinna with thickness and a rounded tip.

    This keeps the existing ear bones and coloured inset identities but
    replaces the old five-face flat cardboard triangle. Geometry is still
    economical enough to skin and display on mid-range mobile hardware.
    """
    x, y, z = pos
    outward = 1 if x > 0 else -1
    levels, width_steps = 11, 10
    base_z = z-depth*.39
    verts, faces = [], []
    for front in (True, False):
        for row in range(levels):
            t = row / (levels-1)
            width = radius * (.035 + .965*(1-t)**.81)
            centre_x = x + outward*radius*.14*t
            height = base_z+depth*.95*t
            for step in range(width_steps+1):
                u = 2*step/width_steps-1
                # A gentle concavity faces the camera (+Y); ear cartilage is
                # fuller at the base and curves toward the tip.
                cup = .057*(1-u*u)*math.sin(math.pi*t)
                front_y = y+.028*(1-t)-.054*t+cup
                offset = 0 if front else -.075*(.4+.6*(1-t))
                verts.append((centre_x+u*width, front_y+offset, height))
    layer_size = levels*(width_steps+1)
    for surface in (0,1):
        offset = surface*layer_size
        for row in range(levels-1):
            for step in range(width_steps):
                a = offset+row*(width_steps+1)+step
                b = a+1
                c = b+width_steps+1
                d = a+width_steps+1
                faces.append((a,b,c,d) if surface == 0 else (d,c,b,a))
    for row in range(levels-1):
        for edge in (0,width_steps):
            a = row*(width_steps+1)+edge
            b = (row+1)*(width_steps+1)+edge
            faces.append((a,b,b+layer_size,a+layer_size))
    for step in range(width_steps):
        a,b=step,step+1
        faces.append((a+layer_size,b+layer_size,b,a))
        a=(levels-1)*(width_steps+1)+step
        b=a+1
        faces.append((a,b,b+layer_size,a+layer_size))
    mesh = bpy.data.meshes.new(name + " cupped cartilage")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    ob = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(ob)
    ob.data.materials.append(mat)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
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



def coat_microrelief(ob, strength=.0045):
    """Small deterministic geometry detail survives glTF, unlike Blender-only noise nodes.

    It is a low-frequency fur *hint*, not strand-based hair or true coat shading.
    The amplitude is limited to avoid an expensive duplicate shell and remains
    far below the eye/facial morph and gait-contact budgets.
    """
    verts = ob.data.vertices
    centre = sum((v.co for v in verts), Vector()) / len(verts)
    for vertex in verts:
        p = vertex.co
        direction = p-centre
        if direction.length < 1e-5:
            continue
        noise = (math.sin(p.x*49.1 + p.y*21.3) *
                 math.sin(p.z*41.7 - p.x*18.9))
        vertex.co += direction.normalized() * (noise * strength)
    ob.data.update()
    return ob


def smooth_limb_sections(sections):
    """Curve through hock and elbow profiles without moving the sole endpoints."""
    result = []
    for i in range(len(sections)-1):
        p0 = sections[max(i-1, 0)]
        p1 = sections[i]
        p2 = sections[i+1]
        p3 = sections[min(i+2, len(sections)-1)]
        for j in range(4):
            t = j/4
            result.append(tuple(.5*(2*p1[k] + (-p0[k]+p2[k])*t +
                (2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t*t +
                (-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t*t*t)
                for k in range(4)))
    return result+[sections[-1]]


def joined_limb(name, side, fore, hip_y, hip_z, mat, gold):
    """One manifold anatomical limb instead of separate floating thigh and paw balls.

    Elliptical cross-sections trace shoulder/thigh, elbow/hock, shin and the
    widened toe. Three overlapping weights keep the whole surface deforming
    through Body -> Upper -> Lower without visible between-mesh leg seams.
    """
    label = name
    x = side*.46
    if fore:
        sections = [
            (.13, -.045, .195, .205), (-.02, -.028, .200, .205),
            (-.18, -.022, .175, .185), (-.34, -.008, .138, .148),
            (-.48, -.004, .122, .124), (-.62, .012, .113, .123),
            (-.74, .049, .114, .132), (-.82, .105, .158, .182),
            (-.895, .120, .161, .178), (-.945, .102, .090, .112),
        ]
    else:
        sections = [
            (.13, -.048, .235, .237), (-.03, -.078, .238, .224),
            (-.20, -.100, .215, .203), (-.36, -.085, .163, .161),
            (-.48, -.052, .133, .132), (-.62, .009, .114, .122),
            (-.75, .067, .119, .135), (-.83, .121, .167, .185),
            (-.895, .133, .169, .179), (-.955, .108, .090, .108),
        ]
    sections = smooth_limb_sections(sections)
    sides = 32
    vertices = []
    for z, y, rx, ry in sections:
        for step in range(sides):
            a = 2*math.pi*step/sides
            # Three gently defined toes remain in the single deforming limb.
            toe = max(0, 1-abs(z+.855)/.105)
            knuckle = toe*.006*math.cos(3*a)
            vertices.append((x + (rx+knuckle)*math.cos(a),
                             hip_y + y + (ry+knuckle)*math.sin(a), hip_z + z))
    faces = []
    for ring in range(len(sections)-1):
        for step in range(sides):
            a = ring*sides+step
            b = ring*sides+(step+1)%sides
            c = (ring+1)*sides+(step+1)%sides
            d = (ring+1)*sides+step
            faces.append((a,b,c,d))
    top = len(vertices)
    vertices.append((x,hip_y+sections[0][1],hip_z+sections[0][0]))
    bottom = len(vertices)
    vertices.append((x,hip_y+sections[-1][1],hip_z+sections[-1][0]))
    for step in range(sides):
        faces.append((top,(step+1)%sides,step))
        a=(len(sections)-1)*sides+step
        b=(len(sections)-1)*sides+(step+1)%sides
        faces.append((bottom,a,b))
    # A tiny four-lobe sculpt is applied to the connected paw *before*
    # armature weights and the glTF normal-map UVs are generated.
    vertices = [toe_position(*position, x, hip_y, hip_z) for position in vertices]
    mesh = bpy.data.meshes.new(label+" seamless limb geometry")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    # UV coordinates let the exported glTF fur normal map follow the leg
    # surface. Keep ring seams deliberate rather than relying on Blender's
    # automatic UVs (these generated meshes have none by default).
    uv = mesh.uv_layers.new(name="Limb coat UV")
    for face in mesh.polygons:
        seam = {mesh.loops[loop].vertex_index % sides
                for loop in face.loop_indices}
        wrap = 0 in seam and sides-1 in seam
        for loop_index in face.loop_indices:
            vi = mesh.loops[loop_index].vertex_index
            row = min(vi // sides, len(sections)-1)
            u = (vi % sides) / sides
            if wrap and vi % sides == 0:
                u = 1.0
            uv.data[loop_index].uv = (u, row / (len(sections)-1))
    ob = bpy.data.objects.new(label+" lower paw", mesh)
    bpy.context.collection.objects.link(ob)
    mesh.materials.append(mat)
    mesh.materials.append(gold)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
        midpoint = sum((mesh.vertices[i].co for i in polygon.vertices), Vector())/len(polygon.vertices)
        if not fore and side>0 and midpoint.z>hip_z-.31 and midpoint.x>.32:
            polygon.material_index = 1
    ob["distal_cutoff_z"] = hip_z-.61
    coat_microrelief(ob, .0035)
    bind(ob, label+"_Upper")
    upper = ob.vertex_groups.get(label+"_Upper")
    lower = ob.vertex_groups.new(name=label+"_Lower")
    body = ob.vertex_groups.new(name="Body")
    for v in ob.data.vertices:
        body_w = .52*smoothstep(hip_z-.20,hip_z+.12,v.co.z)
        lower_w = .93*(1-smoothstep(hip_z-.69,hip_z-.28,v.co.z))
        upper_w = 1.0-body_w-lower_w
        if upper_w < .005:
            raise RuntimeError("Limb weight budget went negative: "+label)
        upper.add([v.index],upper_w,"REPLACE")
        if lower_w > .0001:
            lower.add([v.index],lower_w,"REPLACE")
        if body_w > .0001:
            body.add([v.index],body_w,"REPLACE")
    return ob


def fur_tuft_group(name, strokes, mat, bone):
    """Batch many tapered, volumetric coat tips into ONE small skinned draw mesh.

    These follow the existing illustration's silhouette; they are not
    thousands of transparent hair cards that would overdraw on mobile GPUs.
    """
    verts, faces = [], []
    for start, end, radius in strokes:
        origin, tip = Vector(start), Vector(end)
        direction = (tip-origin).normalized()
        tangent = direction.cross(Vector((0,1,0)))
        if tangent.length < .0001:
            tangent = direction.cross(Vector((1,0,0)))
        tangent.normalize()
        bitangent = direction.cross(tangent).normalized()
        offset = len(verts)
        for j in range(5):
            a = 2*math.pi*j/5
            p = origin + radius*(tangent*math.cos(a)+bitangent*math.sin(a))
            verts.append(tuple(p))
        verts.append(tuple(tip))
        for j in range(5):
            faces.append((offset+j,offset+(j+1)%5,offset+5))
    if not strokes:
        return None
    mesh=bpy.data.meshes.new(name+" geometry")
    mesh.from_pydata(verts,[],faces)
    mesh.update()
    ob=bpy.data.objects.new(name,mesh)
    bpy.context.collection.objects.link(ob)
    mesh.materials.append(mat)
    for p in mesh.polygons:
        p.use_smooth=True
    bind(ob,bone)
    return ob



def feline_upper_lid(name, side, mat):
    """A deforming upper-eyelid ribbon, replacing the static smile-line arc.

    Eyelids slide down over the cornea on Blink; the original iris and pupil
    still compress via their own morphs. This is constrained skin animation,
    not a claim of eye muscles or anatomical eyelid simulation.
    """
    cx, cy, cz = side * .29, 1.044, 1.74
    columns = 21
    vertices, faces = [], []
    for i in range(columns):
        u = 2 * i / (columns - 1) - 1
        coverage = max(0, 1 - u * u) ** .5
        x = cx + .096 * u
        front_y = cy - .007 * u * u
        upper_z = cz + .045 + .026 * coverage
        vertices.extend(((x, front_y, upper_z),
                         (x, front_y, upper_z - .021)))
    for i in range(columns - 1):
        a = 2 * i
        faces.append((a, a + 2, a + 3, a + 1))
    mesh = bpy.data.meshes.new(name + " skinned eyelid geometry")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    ob = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(ob)
    mesh.materials.append(mat)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    ob.shape_key_add(name="Basis")
    basis = ob.data.shape_keys.key_blocks["Basis"].data
    blink = ob.shape_key_add(name="Blink_" + ("L" if side < 0 else "R"))
    wide = ob.shape_key_add(name="Eye_Wide")
    for i in range(columns):
        u = 2 * i / (columns - 1) - 1
        coverage = max(0, 1 - u * u) ** .5
        for offset in (0, 1):
            k = 2 * i + offset
            src = basis[k].co
            blink.data[k].co = (src.x, src.y, src.z - .062 * coverage)
            wide.data[k].co = (src.x, src.y, src.z + .016 * coverage)
    bind(ob, "Head")
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
    cream = material("Calico ivory fur", (.93, .87, .75), .94)
    white = material("Face cream", (1, .956, .87), .93)
    gold = material("Calico amber", (.87, .53, .23), .94)
    cocoa = material("Calico chocolate", (.33, .20, .17), .92)
    blush = material("Calico cheeks", (.95, .83, .78))
    pink = material("Ear and paw pink", (.98, .56, .58))
    nose = material("Little coral nose", (.98, .28, .32))
    dark = material("Eye and mouth cocoa", (.19, .10, .095), .62)
    iris_gold = material("Feline amber iris", (.57, .37, .16), .28)
    pupil_black = material("Feline dark pupil", (.045, .031, .025), .16)
    # Restrained glTF-compatible corneal clearcoat, only on eye materials.
    for optic in (iris_gold, pupil_black):
        bsdf = optic.node_tree.nodes.get("Principled BSDF")
        coat = bsdf.inputs.get("Coat Weight")
        if coat is not None:
            coat.default_value = .23
        rough = bsdf.inputs.get("Coat Roughness")
        if rough is not None:
            rough.default_value = .16
    mouth_red = material("Open mouth ruby", (.65, .13, .16))
    body = make_mesh("Longer natural calico torso", (0, -.27, .94), (.59, .94, .54), cream, "Body", 64, 40)
    apply_sculpt(body, torso_position)
    coat_microrelief(body)
    soften_skin(body, "Body", "Neck", lambda v:
                .48 * smoothstep(.02,.58,v.y) * smoothstep(.78,1.39,v.z))
    body.data.materials.append(gold)
    body.data.materials.append(cocoa)
    for polygon in body.data.polygons:
        points = [body.data.vertices[i].co for i in polygon.vertices]
        avg = sum(points, Vector()) / len(points)
        # Organic coat borders, not a rectangular painted thigh.
        wave = .052*math.sin(avg.y*11.3+avg.z*7.7)
        wave += .026*math.sin(avg.y*21.1-avg.x*6.9)
        if avg.x > .31+wave and -.86-wave < avg.y < .25+wave and avg.z < 1.30+wave:
            polygon.material_index = 1
        if avg.x < -.32+wave and -.68 < avg.y < -.22 and avg.z > 1.16+wave:
            polygon.material_index = 2
    ruff = make_mesh("Cream fluffy ruff", (0, .14, 1.12),
                     (.52, .42, .43), white, "Neck", 40, 28)
    coat_microrelief(ruff, .006)
    soften_skin(ruff, "Neck", "Body", lambda v:
                .72 * (1-smoothstep(.81,1.27,v.z)))
    # Painted calico forehead and ears carry the distinct original markings.
    make_mesh("Soft belly", (0, .36, .82), (.39, .28, .34), white, "Body")
    face = make_mesh("One-piece calico rounded face", (0, .53, 1.60),
                     (.58, .53, .52), white, "Head", 128, 88)
    apply_sculpt(face, skull_position)
    coat_microrelief(face, .003)
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
    make_cone("Screen-left amber ear", (.46, .45, 2.15), .245, .51, gold, "Ear_R")
    make_cone("Screen-right chocolate ear", (-.46, .45, 2.15), .245, .51, cocoa, "Ear_L")
    make_cone("Screen-left rose ear inset", (.46, .52, 2.17), .12, .30, pink, "Ear_R")
    make_cone("Screen-right rose ear inset", (-.46, .52, 2.17), .12, .30, pink, "Ear_L")
    for side, label in ((-1, "Left"), (1, "Right")):
        cheek = make_mesh(label+" rose cheek", (side*.40, .945, 1.45),
                          (.070, .012, .036), blush, "Head")
        cheek.shape_key_add(name="Basis")
        puff = cheek.shape_key_add(name="Cheek_Puff")
        for source, vertex in zip(cheek.data.shape_keys.key_blocks["Basis"].data, puff.data):
            vertex.co = (source.co.x + side*.034,
                         source.co.y + .022, source.co.z + .012)
    make_mesh("Left muzzle", (-.135, 1.05, 1.34), (.146, .060, .081), white, "Head")
    make_mesh("Right muzzle", (.135, 1.05, 1.34), (.146, .060, .081), white, "Head")
    nose_mesh = make_mesh("Heart shaped coral nose", (0, 1.115, 1.46),
                          (.065, .038, .037), nose, "Head")
    nose_mesh.shape_key_add(name="Basis")
    sniff = nose_mesh.shape_key_add(name="Sniff")
    for source, vertex in zip(nose_mesh.data.shape_keys.key_blocks["Basis"].data, sniff.data):
        vertex.co = (source.co.x*1.18, source.co.y+.018, 1.46+(source.co.z-1.46)*1.09)
    mouth = make_mesh("Dark living mouth", (0, 1.10, 1.18), (.155, .038, .102), mouth_red, "Jaw")
    shape_target(mouth, "Jaw_Open", 1.43)
    smile = mouth.shape_key_add(name="Smile")
    for source, vertex in zip(mouth.data.shape_keys.key_blocks["Basis"].data, smile.data):
        bend = min(1.0, abs(source.co.x)/.21)
        vertex.co = (source.co.x*1.09, source.co.y, source.co.z+.052*bend)
    tongue = make_mesh("Licking pink tongue", (0, 1.145, 1.14), (.110, .029, .052), pink, "Tongue")
    shape_target(tongue, "Lick", 1.60)
    for side in (-1, 1):
        pos = "L" if side < 0 else "R"
        # An amber iris under a slim dark feline pupil replaces button eyes.
        # Both layers blink with the original keyed expressions.
        iris = make_mesh("%s amber iris" % pos, (side*.29, .990, 1.74),
                         (.073, .027, .066), iris_gold, "Head", 32, 20)
        shape_target(iris, "Blink_" + pos, .12)
        wide_iris = iris.shape_key_add(name="Eye_Wide")
        iris_basis = iris.data.shape_keys.key_blocks["Basis"].data
        for source, target in zip(iris_basis, wide_iris.data):
            target.co = (source.co.x, source.co.y,
                         1.74 + (source.co.z - 1.74) * 1.12)
        eye = make_mesh("%s deep cocoa eye" % pos, (side*.29, 1.013, 1.74),
                        (.031, .015, .058), pupil_black, "Head", 32, 20)
        shape_target(eye, "Blink_" + pos, .12)
        # Additional shape key for exaggerated curiosity.
        key = eye.shape_key_add(name="Eye_Wide")
        for src, dst in zip(eye.data.shape_keys.key_blocks["Basis"].data, key.data):
            dst.co = (src.co.x, src.co.y, 1.74+(src.co.z-1.74)*1.85)
        # Both upper lids now physically change geometry with Blink/Eye_Wide,
        # rather than remaining fixed, oversized eyebrow-like smile curves.
        feline_upper_lid("%s upper eyelid" % pos, side, white)
        # Tiny catchlight follows the skull; leave eye blink/curious shapes
        # on the underlying eye mesh, not the reflection.
        make_mesh("%s eye catchlight" % pos,
                  (side*.29-.022, 1.045, 1.775),
                  (.010, .005, .010), white, "Head", 16, 12)
        for whisker in range(3):
            z = 1.34 + (whisker-1)*.12
            make_curve("%s whisker %s" % (pos, whisker),
                       [(side*.42, 1.068, 1.36),
                        (side*.57, 1.085, 1.36+(whisker-1)*.04),
                        (side*(.78 + whisker*.03), 1.04, z)],
                       cocoa, "Head", .007)
    for fore in (True, False):
        y = .33 if fore else -.69
        z = 1.02 if fore else .89
        for side in (-1, 1):
            label = ("Front" if fore else "Rear") + ("_L" if side < 0 else "_R")
            x = side*.46
            # The entire upper limb, elbow, shin and toe are one connected
            # surface; skinning follows the existing articulated skeleton.
            joined_limb(label, side, fore, y, z, cream, gold)
            # Pads belong to each paw's own underside, not a shared absolute
            # world height. The previous z=.18 made rear pads float about 26 cm
            # above the evaluated stance paw despite correct lower-mesh contact.
            # Keep the rear pad tied to the calibrated WALK stance geometry.
            # Grounding its idle/groom pose is a skeletal animation problem,
            # not a reason to move the pad 20 cm above planted walking toes.
            toe_pad = make_mesh(label + " rosy toe pad",
                                (x,y+.19,z-(.89 if fore else .95)), (.12,.035,.08),
                                pink, label + "_Lower", 16,12)
            soften_skin(toe_pad, label+"_Lower", label+"_Upper",
                        lambda v: .13)
    # A few low-overdraw, batched tapered fur tips interrupt the spherical
    # silhouette. Microrelief on torso/ruff/head/legs adds genuine highlights
    # to exported geometry without unstable procedural glTF shader nodes.
    for side in (-1,1):
        fur_tuft_group("Fur cheek %s" % side, [
            ((side*(.575 + i*.007), .79, 1.29+i*.08),
             (side*(.655 + i*.008), .81, 1.27+i*.09), .018)
            for i in range(5)
        ], white, "Head")
        fur_tuft_group("Fur ruff %s" % side, [
            ((side*(.45 + i*.012), .12+i*.035, .95+i*.075),
             (side*(.55 + i*.014), .14+i*.038, .89+i*.082), .023)
            for i in range(7)
        ], white, "Neck")
    for side in (-1, 1):
        fur_tuft_group("Fur outer flank %s" % side, [
            ((side*.54, -.85+i*.075, 1.14+.045*math.sin(i*.65)),
             (side*.585, -.82+i*.075, 1.145+.045*math.sin(i*.65)), .008)
            for i in range(17)
        ], cream, "Body")
    fur_tuft_group("Fur dorsal coat", [
        ((.32*math.sin(i*2.399), -.94+i*.064, 1.44),
         (.33*math.sin(i*2.399), -.91+i*.064, 1.463), .008)
        for i in range(23)
    ], cream, "Body")
    # A continuous-looking curled tail profile, not two disconnected spheres.
    make_curve("Amber tail base", [(0,-.96,.92), (0,-1.11,1.01),
                                  (0,-1.21,1.18)], gold, "Tail_1", .11)
    make_curve("Dark tipped tail", [(0,-1.21,1.18), (0,-1.27,1.31),
                                   (0,-1.22,1.46)], cocoa, "Tail_2", .10)
    # Add an independent little whisker/tongue/mouth assembly through the rig.
    # This rig is intentionally visually recognisable but is not a scanned pet.


def set_pose(frame, *, root_y=0, root_z=0, root_x=0, body_z=0, body_pitch=0,
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
    RIG.pose.bones["Root"].location = (root_x, root_z - .048, -root_y)
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
    # Reuse the actual validated heel/hock stance pose for idle, eating,
    # grooming and sniffing rather than letting the hind legs revert to
    # Blender bone-neutral and sink through the floor.
    supported = {
        "Rear_L": walk_leg_pose(0.0, False, -1)[0],
        "Rear_R": walk_leg_pose(0.0, False, 1)[0],
    }
    if legs:
        supported.update(legs)
    for name, (upper, lower) in supported.items():
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


def evaluated_lowest(name):
    """Lowest WORLD-Z point of the actual evaluated skinned preview mesh."""
    ob = bpy.data.objects[name]
    bpy.context.view_layer.update()
    graph = bpy.context.evaluated_depsgraph_get()
    evaluated = ob.evaluated_get(graph)
    mesh = evaluated.to_mesh(preserve_all_data_layers=False, depsgraph=graph)
    try:
        return min((evaluated.matrix_world @ vertex.co).z for vertex in mesh.vertices)
    finally:
        evaluated.to_mesh_clear()


def fit_nonwalk_support(frame, raised=()):
    """Keep supported feet above the ground after non-walk body/head animation.

    The exported cat has no runtime rigid-body collision solver. Measure and
    correct the *evaluated* paw AND cosmetic pad against world-Z instead of
    trusting the knee-tip rig. Skip raised grooming limbs, preserving the
    independently measured paw-to-muzzle interaction.
    """
    for fore in (True, False):
        for side in (-1, 1):
            label = ("Front" if fore else "Rear") + ("_L" if side < 0 else "_R")
            if label in raised:
                continue
            surfaces = (label+" lower paw", label+" rosy toe pad")
            def low():
                return min(evaluated_lowest(name) for name in surfaces)

            before = low()
            # A jumping/playing paw above ground must remain airborne.
            # Correct penetration only: forcing every paw to z=.006 would
            # flatten existing Play bounce and flight arcs.
            if before >= .002:
                continue
            bone = RIG.pose.bones[label+"_Lower"]
            original = bone.location.y
            probe = .018
            bone.location.y = original + probe
            tested = low()
            bone.location.y = original
            gradient = (tested-before)/probe
            if not math.isfinite(gradient) or abs(gradient) < .13:
                raise RuntimeError(
                    "Support-foot contact derivative is invalid: %s %.4f" %
                    (label, gradient)
                )
            correction = max(-.28, min(.28, (.006-before)/gradient))
            bone.location.y = original + correction
            bone.keyframe_insert("location", frame=frame, group=bone.name)
            after = low()
            if not (-.045 <= after <= .050):
                raise RuntimeError(
                    "Supported paw cannot reach ground: %s frame=%d before=%.3f after=%.3f" %
                    (label, frame, before, after)
                )
            if frame in (1, 21, 25, 49):
                print("NONWALK_PAW_SUPPORT %s frame=%d %.4f -> %.4f" %
                      (label, frame, before, after), flush=True)


def evaluated_mesh_centre(name):
    """Axis-aligned centre of the deforming paw TIP (or full facial mesh)."""
    ob = bpy.data.objects[name]
    bpy.context.view_layer.update()
    graph = bpy.context.evaluated_depsgraph_get()
    active = ob.evaluated_get(graph)
    mesh = active.to_mesh(preserve_all_data_layers=False, depsgraph=graph)
    try:
        cutoff = ob.get("distal_cutoff_z")
        points = [active.matrix_world @ vertex.co for vertex in mesh.vertices
                  if cutoff is None or ob.data.vertices[vertex.index].co.z <= cutoff]
        if not points:
            raise RuntimeError("No distal paw vertices for "+name)
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
                # In-place gait with restrained lateral trunk weight shift.
                # This is not force feedback or world-locked foot planting.
                sway, pitch = walk_weight_shift(t)
                set_pose(frame, root_z=root_height(t)+.048,
                         root_x=sway, body_pitch=pitch,
                         head_pitch=-.035*math.sin(cycle*2)-.5*pitch,
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
                # The reference calico springs into two buoyant airborne beats.
                # Root_z here is world vertical via the armature's local Y.
                hop = .235 * math.sin(cycle)**2
                set_pose(frame, root_z=hop,
                         body_pitch=.13*math.sin(cycle*2), head_pitch=-.14,
                         head_yaw=.18*math.sin(cycle), tail=.43*math.sin(cycle*3),
                         ears=.14*math.sin(cycle*2),
                         legs={
                             "Front_L":(-.38*math.sin(cycle)**2, .27*math.sin(cycle)**2),
                             "Front_R":(-.38*math.sin(cycle)**2, .27*math.sin(cycle)**2),
                         })
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
                fit_nonwalk_support(frame, raised=("Front_L",))
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
            if clip not in ("Walk", "Groom"):
                fit_nonwalk_support(frame)
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
    prepare_fur_normals(out)
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
        rig="Connected single-surface limbs with Body/Upper/Lower skin weights; two-link kinematic gait",
        appearance="Rebalanced torso/face silhouette, geometric coat relief and batched sculpted fur tips",
        physics="Two-link IK, evaluated paw-ground and grooming-target fitting; no dynamic collision or muscle simulation",
        sha256=hashlib.sha256(glb.read_bytes()).hexdigest(),
        bytes=glb.stat().st_size,
    )
    (out/"nuzzle-calico-rig.json").write_text(json.dumps(manifest,indent=2)+"\n")
    print("CALICO-CANDIDATE: "+json.dumps(manifest))


if __name__=="__main__":
    main()
