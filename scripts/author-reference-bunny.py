"""Reference-specific rigged bunny authoring candidate for the MyPets 3D pipeline.

Run with Blender 4.5+/5.x:
  blender --background --factory-startup --python scripts/author-reference-bunny.py -- \
    --output-dir /tmp/mypets-reference-bunny

Produces an editable .blend, rigged .glb and review PNGs. This is an UNAPPROVED
procedural modelling STARTING POINT: a single illustration cannot establish
unseen geometry, and Blender renders must be compared with the user's image.
Never auto-promote its output to public/models or replace the original artwork.
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

FPS = 30
CLIPS = {
    "Idle": 120,
    "Walk": 36,
    "Hop": 45,
    "Sit": 30,
    "LieDown": 48,
    "Sleep": 150,
    "Happy": 60,
    "Sad": 75,
    "Play": 120,
    "PetReaction": 48,
}
MORPHS = (
    "eyeBlink_L", "eyeBlink_R", "eyeWide_L", "eyeWide_R",
    "browSad_L", "browSad_R", "mouthSmile", "mouthOpen", "mouthFrown",
    "cheekPuff", "muzzleRaise_L", "muzzleRaise_R", "noseScrunch",
)
IVORY = (.985, .971, .937)
ROSE = (1.0, .55, .59)
BROWN = (.17, .080, .068)
CORAL = (1.0, .25, .32)


def material(name, color, rough=.72, alpha=1.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, alpha)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, alpha)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = 0.0
    if alpha != 1:
        bsdf.inputs["Alpha"].default_value = alpha
    return mat


def bind(obj, rig, weights):
    """Skin geometry to armature; weights can be constant or vertex-dependent."""
    for name, weight in weights.items():
        if name not in rig.data.bones:
            raise RuntimeError("Missing rig bone: " + name)
        group = obj.vertex_groups.new(name=name)
        if callable(weight):
            for v in obj.data.vertices:
                w = max(0.0, min(1.0, weight(v.co)))
                if w > 1e-5:
                    group.add([v.index], w, "REPLACE")
        elif weight > 0:
            group.add(list(range(len(obj.data.vertices))), weight, "REPLACE")
    mod = obj.modifiers.new("Skinned bunny deformation", "ARMATURE")
    mod.object = rig
    obj.parent = rig
    return obj


def sphere(name, center, scale, mat, rig, bone, segments=40, rings=28, tilt=0):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings)
    obj = bpy.context.object
    obj.name = name
    obj.location = center
    obj.scale = scale
    obj.rotation_euler.y = tilt
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return bind(obj, rig, {bone: 1})


def shape(obj, name, change):
    if obj.data.shape_keys is None:
        obj.shape_key_add(name="Basis")
    block = obj.shape_key_add(name=name)
    for point in block.data:
        change(point.co)
    return block


def tube(name, coords, thickness, mat, rig, bone):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 12
    curve.bevel_depth = thickness
    curve.bevel_resolution = 4
    path = curve.splines.new("POLY")
    path.points.add(len(coords)-1)
    for p, xyz in zip(path.points, coords):
        p.co = (*xyz, 1)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.object
    obj.data.materials.append(mat)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return bind(obj, rig, {bone: 1})


def rig():
    data = bpy.data.armatures.new("Bunny skeletal rig")
    obj = bpy.data.objects.new("Bunny_Armature", data)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bones = [
        ("Root", None, (0, 0, .18), (0, 0, .45)),
        ("Pelvis", "Root", (0, 0, .40), (0, 0, .70)),
        ("Spine", "Pelvis", (0, 0, .70), (0, 0, .98)),
        ("Chest", "Spine", (0, 0, .98), (0, .02, 1.22)),
        ("Neck", "Chest", (0, .05, 1.22), (0, .08, 1.40)),
        ("Head", "Neck", (0, .08, 1.42), (0, .08, 1.93)),
        ("Jaw", "Head", (0, .52, 1.40), (0, .60, 1.26)),
        ("Nose", "Head", (0, .62, 1.57), (0, .71, 1.60)),
        ("Tail", "Pelvis", (0, -.35, .65), (0, -.55, .78)),
    ]
    for side in (-1, 1):
        suffix = "L" if side < 0 else "R"
        x = side
        bones.extend([
            ("Shoulder_" + suffix, "Chest", (x*.33, .02, 1.16), (x*.47, .10, 1.10)),
            ("UpperArm_" + suffix, "Shoulder_" + suffix, (x*.47, .10, 1.10), (x*.55, .24, .94)),
            ("Forearm_" + suffix, "UpperArm_" + suffix, (x*.55, .24, .94), (x*.55, .37, .80)),
            ("Paw_" + suffix, "Forearm_" + suffix, (x*.55, .37, .80), (x*.55, .47, .72)),
            ("Thigh_" + suffix, "Pelvis", (x*.25, .00, .61), (x*.31, .12, .39)),
            ("Shin_" + suffix, "Thigh_" + suffix, (x*.31, .12, .39), (x*.31, .20, .21)),
            ("Foot_" + suffix, "Shin_" + suffix, (x*.31, .20, .21), (x*.31, .43, .15)),
            ("Toe_" + suffix, "Foot_" + suffix, (x*.31, .43, .15), (x*.31, .50, .15)),
            ("Ear_01_" + suffix, "Head", (x*.37, .02, 1.94), (x*.48, .02, 2.19)),
            ("Ear_02_" + suffix, "Ear_01_" + suffix, (x*.48, .02, 2.19), (x*.52, .00, 2.50)),
            ("Ear_03_" + suffix, "Ear_02_" + suffix, (x*.52, .00, 2.50), (x*.54, -.02, 2.73)),
            ("Brow_" + suffix, "Head", (x*.28, .56, 1.82), (x*.28, .58, 1.87)),
        ])
    for name, parent, start, end in bones:
        bone = data.edit_bones.new(name)
        bone.head, bone.tail = start, end
        if parent:
            bone.parent = data.edit_bones[parent]
            bone.use_connect = False
    bpy.ops.object.mode_set(mode="OBJECT")
    for pose in obj.pose.bones:
        pose.rotation_mode = "XYZ"
    bpy.ops.object.select_all(action="DESELECT")
    return obj


def vertex_blush(head):
    """Blend blush into the main facial surface; avoid pasted-on pink discs."""
    layer = head.data.color_attributes.new(
        name="BunnyFaceColor", type="FLOAT_COLOR", domain="CORNER")
    for poly in head.data.polygons:
        for li in poly.loop_indices:
            vert = head.data.vertices[head.data.loops[li].vertex_index].co
            # Normalised Gaussian around the two cheeks.
            w = 0.0
            for side in (-1, 1):
                w += math.exp(-(
                    ((vert.x-side*.49)/.17)**2
                    + ((vert.z-1.34)/.115)**2
                    + ((vert.y-.43)/.19)**2
                ) * 1.5)
            w = min(.65, w*.6)
            layer.data[li].color = tuple(
                IVORY[k]*(1-w) + ROSE[k]*w for k in range(3)) + (1.0,)
    shader = head.data.materials[0].node_tree
    color_node = shader.nodes.new("ShaderNodeVertexColor")
    color_node.layer_name = "BunnyFaceColor"
    shader.links.new(color_node.outputs["Color"],
                     shader.nodes["Principled BSDF"].inputs["Base Color"])


def make_ear(side, rig_obj, mats):
    s = "L" if side < 0 else "R"
    # Sculpt a continuously tapering, curved ear with no intersecting spheres.
    verts, faces = [], []
    n_ring, n_side = 24, 20
    for j in range(n_ring + 1):
        t = j/n_ring
        z = 1.90 + .89*t
        cx = side*(.36+.18*t + .035*math.sin(math.pi*t))
        cy = .035-.05*t
        width = .15*max(.09, math.sin(math.pi*(t*.91+.055))**.6)
        depth = .096*max(.09, math.sin(math.pi*(t*.91+.055))**.6)
        for k in range(n_side):
            a = math.tau*k/n_side
            verts.append((cx+width*math.cos(a), cy+depth*math.sin(a), z))
    for j in range(n_ring):
        for k in range(n_side):
            a = j*n_side+k
            b = j*n_side+(k+1)%n_side
            faces.append((a,b,b+n_side,a+n_side))
    faces.append(tuple(reversed(tuple(range(n_side)))))
    faces.append(tuple(n_ring*n_side+k for k in range(n_side)))
    data = bpy.data.meshes.new("Bunny ear sculpt " + s)
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new("Bunny_Ear_" + s, data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mats["ivory"])
    for poly in obj.data.polygons:
        poly.use_smooth = True
    def base(co):
        t = (co.z-1.9)/.89
        return max(0.0, 1-2*t)
    def middle(co):
        t = (co.z-1.9)/.89
        return max(0.0, 1-abs(2*t-1))
    def tip(co):
        t = (co.z-1.9)/.89
        return max(0.0, 2*t-1)
    bind(obj, rig_obj, {
        "Ear_01_"+s: base, "Ear_02_"+s: middle, "Ear_03_"+s: tip,
    })
    # Inner ear lining: separate smooth surface attached to middle ear chain.
    inner = sphere("Bunny_EarInner_"+s,
                   (side*.46, .132, 2.34), (.098, .021, .375),
                   mats["inner"], rig_obj, "Ear_02_"+s, 30, 22,
                   tilt=-side*.14)
    return obj, inner


def facial_features(rig_obj, mats):
    head = sphere("Bunny_Head", (0, .10, 1.58), (.76, .55, .63),
                  mats["ivory"], rig_obj, "Head", 64, 48)
    vertex_blush(head)
    for side in (-1, 1):
        s = "L" if side < 0 else "R"
        center = (side*.335, .596, 1.64)
        eye = sphere("Bunny_Eye_"+s, center, (.119, .043, .147),
                     mats["eye"], rig_obj, "Head", 36, 26)
        def blink(co, c=center):
            co.z = c[2] + (co.z-c[2])*.07 + .02*(co.x-c[0])**2
        shape(eye, "eyeBlink_"+s, blink)
        shape(eye, "eyeWide_"+s,
              lambda co, c=center: setattr(co, "z", c[2]+(co.z-c[2])*1.22))
        glint = sphere("Bunny_EyeGlint_"+s,
                       (side*.299, .639, 1.692), (.026, .012, .028),
                       mats["glint"], rig_obj, "Head", 18, 12)
        shape(glint, "eyeBlink_"+s,
              lambda co, c=center: setattr(co, "z", c[2]+(co.z-c[2])*.04))
        brow = tube("Bunny_Brow_"+s, [
            (side*.47, .597, 1.86), (side*.34, .65, 1.89),
            (side*.21, .61, 1.86)], .014, mats["eye"], rig_obj, "Head")
        shape(brow, "browSad_"+s,
              lambda co, side=side: setattr(co, "z", co.z-.06
                  + (co.x*side)*.05))
        muzzle = sphere("Bunny_Muzzle_"+s,
                        (side*.155, .576, 1.382), (.23, .096, .125),
                        mats["ivory"], rig_obj, "Head", 32, 24)
        shape(muzzle, "cheekPuff", lambda co, side=side:
              setattr(co, "x", co.x + side*.045))
        shape(muzzle, "muzzleRaise_"+s, lambda co:
              setattr(co, "z", co.z+.038))
    nose = sphere("Bunny_CoralNose", (0,.671,1.57),(.074,.047,.055),
                  mats["nose"],rig_obj,"Nose",26,18)
    shape(nose, "noseScrunch", lambda co:
          setattr(co,"z",co.z+.018))
    mouth_center=(0,.616,1.31)
    mouth=sphere("Bunny_Mouth",mouth_center,(.187,.039,.139),
                 mats["mouth"],rig_obj,"Jaw",40,30)
    shape(mouth,"mouthSmile",lambda co:
          (setattr(co,"x",co.x*1.18),setattr(co,"z",co.z+.012)))
    shape(mouth,"mouthOpen",lambda co,c=mouth_center:
          setattr(co,"z",c[2]+(co.z-c[2])*1.65))
    shape(mouth,"mouthFrown",lambda co,c=mouth_center:
          setattr(co,"z",c[2]-(co.z-c[2])*.50))
    tongue=sphere("Bunny_Tongue",(0,.667,1.233),(.112,.018,.055),
                  mats["tongue"],rig_obj,"Jaw",26,18)
    shape(tongue,"mouthOpen",lambda co:
          setattr(co,"z",co.z-.034))
    return head


def body_features(rig_obj,mats):
    sphere("Bunny_Body",(0,-.065,.75),(.48,.414,.55),
           mats["ivory"],rig_obj,"Spine",48,36)
    sphere("Bunny_Tail",(0,-.465,.68),(.175,.16,.19),
           mats["ivory"],rig_obj,"Tail")
    for side in (-1,1):
        s="L" if side<0 else "R"
        sphere("Bunny_UpperArm_"+s,(side*.44,.20,1.02),(.20,.18,.28),
               mats["ivory"],rig_obj,"UpperArm_"+s)
        sphere("Bunny_Paw_"+s,(side*.51,.37,.84),(.195,.16,.23),
               mats["ivory"],rig_obj,"Paw_"+s)
        sphere("Bunny_Haunch_"+s,(side*.31,.00,.42),(.245,.23,.29),
               mats["ivory"],rig_obj,"Thigh_"+s)
        foot=sphere("Bunny_Foot_"+s,(side*.32,.23,.16),(.258,.30,.17),
                    mats["ivory"],rig_obj,"Foot_"+s)
        sphere("Bunny_MainPad_"+s,(side*.32,.52,.16),(.106,.018,.074),
               mats["inner"],rig_obj,"Foot_"+s,24,16)
        for i in (-1,0,1):
            sphere("Bunny_Digit_"+s+"_"+str(i),
                   (side*.32+i*.094,.51,.22),
                   (.047,.018,.047),mats["inner"],rig_obj,
                   "Foot_"+s,16,12)


def animate(rig_obj):
    rig_obj.animation_data_create()
    for action_name, end in CLIPS.items():
        action=bpy.data.actions.new(action_name)
        rig_obj.animation_data.action=action
        for frame in sorted(set(list(range(1,end+1,3))+[end])):
            t=(frame-1)/max(1,end-1)
            w=math.tau*t
            for bone in rig_obj.pose.bones:
                bone.location=(0,0,0)
                bone.rotation_euler=(0,0,0)
            root=rig_obj.pose.bones["Root"]
            body=rig_obj.pose.bones["Spine"]
            head=rig_obj.pose.bones["Head"]
            jaw=rig_obj.pose.bones["Jaw"]
            left=rig_obj.pose.bones["UpperArm_L"]
            right=rig_obj.pose.bones["UpperArm_R"]
            ears=[rig_obj.pose.bones["Ear_01_"+s] for s in ("L","R")]
            legs=[rig_obj.pose.bones["Thigh_"+s] for s in ("L","R")]
            if action_name=="Idle":
                body.location.z=.014*math.sin(w)
                head.rotation_euler.y=.038*math.sin(w)
                ears[0].rotation_euler.y=.035*math.sin(w+.4)
            elif action_name=="Walk":
                body.location.z=.025*(1-math.cos(2*w))
                for i in range(2):
                    phase=w+i*math.pi
                    legs[i].rotation_euler.x=.33*math.sin(phase)
                left.rotation_euler.x=.27*math.sin(w+math.pi)
                right.rotation_euler.x=.27*math.sin(w)
            elif action_name=="Hop":
                lift=max(0.0,math.sin(math.pi*t))**1.4
                root.location.z=.36*lift-.05*math.sin(math.pi*t)**8
                body.rotation_euler.x=.14*math.sin(2*math.pi*t)
                for leg in legs:
                    leg.rotation_euler.x=-.28*math.sin(math.pi*t)
                for ear in ears:
                    ear.rotation_euler.x=-.16*lift
            elif action_name=="Sit":
                ease=math.sin(math.pi*t/2)**2
                root.location.z=-.19*ease
                body.rotation_euler.x=.13*ease
                for leg in legs:
                    leg.rotation_euler.x=.39*ease
            elif action_name=="LieDown":
                ease=math.sin(math.pi*t/2)**2
                root.location.z=-.31*ease
                body.rotation_euler.x=.45*ease
                head.rotation_euler.x=-.13*ease
                for leg in legs:
                    leg.rotation_euler.x=.64*ease
            elif action_name=="Sleep":
                root.location.z=-.31
                body.rotation_euler.x=.45
                head.rotation_euler.x=-.13
                body.location.z=.010*math.sin(w)
                for leg in legs:
                    leg.rotation_euler.x=.64
                for ear in ears:
                    ear.rotation_euler.x=.12+.02*math.sin(w)
            elif action_name=="Happy":
                jump=math.sin(2*w)**2
                root.location.z=.10*jump
                left.rotation_euler.x=-.57-.10*jump
                right.rotation_euler.x=-.57-.10*jump
                head.rotation_euler.y=.08*math.sin(w)
                jaw.rotation_euler.x=.10*jump
            elif action_name=="Sad":
                ease=math.sin(math.pi*t/2)**2
                head.rotation_euler.x=.23*ease
                body.rotation_euler.x=.08*ease
                ears[0].rotation_euler.x=.20*ease
                ears[1].rotation_euler.x=.20*ease
                left.rotation_euler.x=.18*ease
                right.rotation_euler.x=.18*ease
            elif action_name=="Play":
                root.location.z=.16*math.sin(2*w)**2
                head.rotation_euler.y=.16*math.sin(w)
                body.rotation_euler.y=.12*math.sin(w)
                left.rotation_euler.x=-.47-.17*math.sin(2*w)
                right.rotation_euler.x=-.47+.17*math.sin(2*w)
            elif action_name=="PetReaction":
                ease=math.sin(math.pi*t)**2
                head.rotation_euler.y=-.19*ease
                head.rotation_euler.x=-.10*ease
                ears[0].rotation_euler.y=.15*ease
                body.location.z=.020*ease
            for bone in rig_obj.pose.bones:
                bone.keyframe_insert(data_path="location",frame=frame,group=bone.name)
                bone.keyframe_insert(data_path="rotation_euler",frame=frame,group=bone.name)
        rig_obj.animation_data.action=None
        track=rig_obj.animation_data.nla_tracks.new()
        track.name=action_name
        strip=track.strips.new(action_name,1,action)
        strip.action_frame_start=1
        strip.action_frame_end=end
        track.mute=False
        track.is_solo=False


def review(rig_obj,out):
    scene=bpy.context.scene
    scene.render.engine="BLENDER_WORKBENCH"
    scene.display.shading.light="STUDIO"
    scene.display.shading.color_type="MATERIAL"
    scene.display.shading.show_cavity=True
    scene.render.resolution_x=760
    scene.render.resolution_y=760
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="PNG"
    scene.display.shading.background_type="WORLD"
    cam_data=bpy.data.cameras.new("Reference review camera")
    cam=bpy.data.objects.new("Reference review camera",cam_data)
    bpy.context.collection.objects.link(cam)
    scene.camera=cam
    cam_data.type="ORTHO"
    cam_data.ortho_scale=3.5
    frames=[("front",(0,6.0,2.0)),("three-quarter",(3.2,5.5,2.55)),
            ("side",(6.0,0,2.0)),("back",(0,-6.0,2.0))]
    for name,position in frames:
        cam.location=position
        cam.rotation_euler=(Vector((0,0,1.38))-cam.location).to_track_quat("-Z","Y").to_euler()
        for track in rig_obj.animation_data.nla_tracks:
            track.mute=True
        scene.frame_set(1)
        scene.render.filepath=str(out/("bunny-"+name+".png"))
        bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam,do_unlink=True)
    for track in rig_obj.animation_data.nla_tracks:
        track.mute=False


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir",required=True)
    args=parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    out=Path(args.output_dir).expanduser().resolve()
    out.mkdir(parents=True,exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    scene=bpy.context.scene
    scene.render.fps=FPS
    rig_obj=rig()
    mats={
        "ivory":material("Bunny warm ivory plush",IVORY,.78),
        "inner":material("Bunny soft pink inner ears and paw pads",ROSE,.84),
        "eye":material("Bunny glossy chocolate eyes",BROWN,.20),
        "glint":material("Bunny catchlight",(1,1,1),.14),
        "nose":material("Bunny pink button nose",CORAL,.32),
        "mouth":material("Bunny cherry mouth",(.35,.025,.07),.55),
        "tongue":material("Bunny salmon tongue",(.98,.34,.43),.46),
    }
    body_features(rig_obj,mats)
    facial_features(rig_obj,mats)
    for side in (-1,1):
        make_ear(side,rig_obj,mats)
    animate(rig_obj)
    scene.frame_set(1)
    blend=out/"reference-bunny-master.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend),check_existing=False)
    # Camera and review-only images must never enter the exported scene.
    bpy.ops.object.select_all(action="DESELECT")
    for obj in scene.objects:
        if obj.type in ("MESH","ARMATURE"):
            obj.select_set(True)
    bpy.context.view_layer.objects.active=rig_obj
    glb=out/"reference-bunny-candidate.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(glb), export_format="GLB", use_selection=True,
        export_animations=True, export_animation_mode="NLA_TRACKS",
        export_morph=True, export_skins=True, export_yup=True,
        export_materials="EXPORT", export_apply=False,
    )
    if not glb.exists() or glb.stat().st_size<15000:
        raise RuntimeError("Blender failed to export a substantive GLB")
    review(rig_obj,out)
    manifest={
        "status":"EXPERIMENTAL_NOT_VISUALLY_APPROVED",
        "reference":"User-supplied chibi white rabbit illustration (single angle)",
        "authored_by":"Blender procedural reference-specific starting point",
        "source":blend.name,
        "candidate":glb.name,
        "sha256":hashlib.sha256(glb.read_bytes()).hexdigest(),
        "actions":list(CLIPS),
        "facial_morphs":list(MORPHS),
        "blender":bpy.app.version_string,
        "visual_approved":False,
        "browser_approved":False,
    }
    (out/"reference-bunny-manifest.json").write_text(
        json.dumps(manifest,indent=2)+"\n",encoding="utf-8")
    print("BUNNY_CANDIDATE_CREATED",json.dumps(manifest))


if __name__=="__main__":
    main()
