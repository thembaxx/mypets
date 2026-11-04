"""Original reference-style chibi character rigs for MyPets.

Three original Blender animals, independently made from the reference video
STYLE (not extracted meshes or video frames). Every GLB has a real armature,
seven distinct authored action tracks, expressive mouth morph and skinned
arms/ears/feet. This is a candidate build, never a production auto-promotion.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

FPS, END = 24, 49
ACTIONS = ("Idle", "Walk", "Eat", "Play", "Rest", "Groom", "Sniff")
KINDS = ("cat", "dog", "rabbit")
COLORS = {
    "cat": {
        "fur": (.99, .93, .83), "patch": (.91, .57, .26),
        "secondary": (.34, .22, .21), "inner": (.99, .55, .59),
    },
    "dog": {
        # Cream muzzle, caramel crown and deep brown floppy ears from dog.jpg.
        "fur": (.99, .94, .83), "patch": (.91, .61, .38),
        "secondary": (.43, .25, .19), "inner": (.98, .51, .49),
    },
    "rabbit": {
        "fur": (.99, .97, .94), "patch": (.93, .68, .42),
        "secondary": (.98, .89, .79), "inner": (.99, .65, .71),
    },
}


def material(name, color, roughness=.62):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    coat = bsdf.inputs.get("Coat Weight")
    if coat is not None:
        coat.default_value = .18
    return mat


def bind(mesh, rig, bone):
    group = mesh.vertex_groups.new(name=bone)
    group.add(list(range(len(mesh.data.vertices))), 1.0, "REPLACE")
    modifier = mesh.modifiers.new("Live character skeleton skin", "ARMATURE")
    modifier.object = rig
    mesh.parent = rig
    return mesh


def sphere(name, xyz, radii, mat, rig, bone, segments=64, rings=48, tilt=0):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings)
    obj = bpy.context.object
    obj.name = name
    obj.location = xyz
    obj.scale = radii
    if tilt:
        obj.rotation_euler.y = tilt
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.data.materials.append(mat)
    for face in obj.data.polygons:
        face.use_smooth = True
    return bind(obj, rig, bone)


def line(name, path, width, mat, rig, bone):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 12
    curve.bevel_depth = width
    curve.bevel_resolution = 3
    spline = curve.splines.new("POLY")
    spline.points.add(len(path)-1)
    for vertex, xyz in zip(spline.points, path):
        vertex.co = (*xyz, 1)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.object
    obj.data.materials.append(mat)
    for face in obj.data.polygons:
        face.use_smooth = True
    return bind(obj, rig, bone)


def skeleton(slug):
    data = bpy.data.armatures.new(slug + " joyful character skeleton")
    rig = bpy.data.objects.new("Chibi_" + slug + "_Armature", data)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bones = {
        "Root": (None, (0, -.05, .28), (0, -.05, .60)),
        "Body": ("Root", (0, 0, .65), (0, .03, 1.14)),
        "Head": ("Body", (0, .08, 1.13), (0, .12, 1.70)),
        "Jaw": ("Head", (0, .55, 1.25), (0, .59, 1.14)),
        "Tail": ("Body", (0, -.33, .75), (0, -.57, .96)),
    }
    for side in (-1, 1):
        suffix = "L" if side < 0 else "R"
        bones["Arm_"+suffix] = ("Body", (side*.34, .02, 1.02), (side*.58, .18, .87))
        bones["Leg_"+suffix] = ("Root", (side*.22, .00, .56), (side*.22, .12, .14))
        bones["Ear_"+suffix] = ("Head", (side*.39, .03, 1.84), (side*.53, .08, 2.14))
    for name, (parent, head, tail) in bones.items():
        bone = data.edit_bones.new(name)
        bone.head = head
        bone.tail = tail
        if parent:
            bone.parent = data.edit_bones[parent]
            bone.use_connect = False
    bpy.ops.object.mode_set(mode="OBJECT")
    for pose in rig.pose.bones:
        pose.rotation_mode = "XYZ"
    bpy.ops.object.select_all(action="DESELECT")
    return rig


def happy_eye(slug, side, pigment, rig):
    # Smooth raised crescent/closed-eye arc, not a static texture or GIF.
    points = []
    for i in range(19):
        u = -1 + 2*i/18
        points.append((side*.285 + .165*u,
                       .630 - .042*u*u,
                       1.59 + .115*(1-u*u)))
    eye=line(slug + (" left" if side<0 else " right") + " smiling eye arc",
             points, .025, pigment, rig, "Head")
    eye.shape_key_add(name="Basis")
    smile=eye.shape_key_add(name="Smile")
    wide=eye.shape_key_add(name="Eye_Wide")
    for base, happy, curious in zip(
        eye.data.shape_keys.key_blocks["Basis"].data,smile.data,wide.data
    ):
        near=max(0.,1-abs(base.co.x-side*.265)/.17)
        happy.co.z=base.co.z+.038*near
        curious.co.z=base.co.z+.070
    return eye


def face(slug, rig, materials):
    """High-detail chibi face with actual surface coat patterns, not floating decals.

    The supplied originals show enormous soft heads, raised closed-eye smiles,
    a smaller button nose, a bright open mouth and subtle cheek blush.
    Material regions are on the *same skinned head mesh* and survive GLB export.
    """
    fur, patch, dark, pink, mouth, tongue = (materials[k] for k in
        ("fur", "patch", "dark", "pink", "mouth", "tongue"))
    dimensions = (.73, .57, .61) if slug == "dog" else (.67, .55, .61)
    head = sphere(slug+" large continuous reference-proportion head",
                  (0, .13, 1.45), dimensions, fur, rig, "Head", 104, 76)
    head.data.materials.append(patch)
    head.data.materials.append(materials["secondary"])
    # Front is +Y. From a frontal camera world +X is viewer left.
    # Coat regions are baked into distinct polygons rather than detached
    # ellipsoids hovering above the skin.
    if slug in ("cat", "dog"):
        for face_poly in head.data.polygons:
            pos = face_poly.center
            if pos.y < .10 or pos.z < 1.54:
                continue
            if slug == "cat":
                if pos.x > .16 and pos.z > 1.69:
                    face_poly.material_index = 1
                elif pos.x < -.24 and pos.z > 1.68:
                    face_poly.material_index = 2
            else:
                if pos.x > .10 and pos.z > 1.61:
                    face_poly.material_index = 1
                elif pos.x < -.53 and pos.z > 1.76:
                    face_poly.material_index = 1

    for side in (-1,1):
        happy_eye(slug, side, dark, rig)
        # Thin surface blush reads as a cheek tint rather than a loose ball.
        cheek=sphere(slug+" gentle rosy cheek "+str(side),
                     (side*.425,.60,1.36),(.17,.017,.115),
                     materials["blush"], rig, "Head", 42, 28)
        cheek.shape_key_add(name="Basis")
        puff=cheek.shape_key_add(name="Cheek_Puff")
        for base,target in zip(cheek.data.shape_keys.key_blocks["Basis"].data,puff.data):
            target.co.x=base.co.x*(1+.06)
            target.co.y=base.co.y+.014
        sphere(slug+" continuous-shaped muzzle cushion "+str(side),
               (side*.115,.675,1.29),(.132,.047,.092),fur,rig,"Head",48,32)

    nose_material = materials["nose"] if slug == "cat" else dark
    sphere(slug+" small soft nose",(0,.710,1.405),
           (.064,.032,.041),nose_material,rig,"Head",32,24)
    opening=sphere(slug+" joyful open mouth", (0,.672,1.205),
           (.235,.047,.168),mouth,rig,"Jaw",56,40)
    opening.shape_key_add(name="Basis")
    smile=opening.shape_key_add(name="Smile")
    wide=opening.shape_key_add(name="Jaw_Open")
    for basis, target_smile, target_wide in zip(
        opening.data.shape_keys.key_blocks["Basis"].data,smile.data,wide.data
    ):
        edge=min(1.,abs(basis.co.x)/.235)
        target_smile.co.z=basis.co.z+.035*edge
        target_smile.co.x=basis.co.x*1.07
        target_wide.co.z=1.205+(basis.co.z-1.205)*1.25
    sphere(slug+" pink happy tongue",(0,.718,1.125),
           (.137,.026,.077),tongue,rig,"Jaw",42,26)
    for side in (-1,1):
        line(slug+" little happy smile edge "+str(side),
             [(side*.17,.708,1.240),(side*.239,.665,1.304)],
             .010,dark,rig,"Head")
        if slug == "cat":
            for offset in (-1,1):
                line(slug+" short cheek whisker "+str(side)+" "+str(offset),
                     [(side*.50,.595,1.345+offset*.038),
                      (side*.61,.562,1.343+offset*.070)],
                     .010,dark,rig,"Head")
    return opening

def triangular_ear(name, side, material_outer, material_inner, rig):
    """Rounded triangular source-like calico pinna with true mesh depth."""
    x = side * .45
    zbase, tip = 1.83, 2.28
    def prism(label, points, depth, material):
        front = [(px, py, pz) for px, py, pz in points]
        back = [(px, py-depth, pz) for px, py, pz in points]
        mesh = bpy.data.meshes.new(label)
        mesh.from_pydata(front+back, [], [
            (0, 2, 1), (3, 4, 5),
            (0, 1, 4, 3), (1, 2, 5, 4), (2, 0, 3, 5),
        ])
        mesh.update()
        obj = bpy.data.objects.new(label, mesh)
        bpy.context.collection.objects.link(obj)
        obj.data.materials.append(material)
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bevel = obj.modifiers.new("Hand-rounded ear edge", "BEVEL")
        bevel.width = .027 if depth > .04 else .008
        bevel.segments = 4
        bpy.ops.object.modifier_apply(modifier=bevel.name)
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
        bone = "Ear_L" if side < 0 else "Ear_R"
        return bind(obj, rig, bone)
    prism(name+" silhouette",
          [(x-.20,.18,zbase), (x+.20,.18,zbase),
           (x+side*.12,.21,tip)], .12, material_outer)
    prism(name+" inset",
          [(x-.118,.253,zbase+.075), (x+.118,.253,zbase+.075),
           (x+side*.103,.272,tip-.095)], .010, material_inner)


def ears(slug, rig, mats):
    inner=mats["pink"]
    if slug=="rabbit":
        for side in (-1,1):
            bone="Ear_L" if side<0 else "Ear_R"
            sphere(slug+" soft standing ear "+str(side),
                   (side*.43,.06,2.12),(.165,.126,.45),
                   mats["fur"],rig,bone,64,42,tilt=-side*.18)
            sphere(slug+" warm inner ear "+str(side),
                   (side*.44,.173,2.13),(.105,.035,.34),
                   inner,rig,bone,52,38,tilt=-side*.18)
    elif slug=="dog":
        for side in (-1,1):
            bone="Ear_L" if side<0 else "Ear_R"
            sphere(slug+" soft wide floppy ear "+str(side),
                   (side*.81,.045,1.82),(.38,.15,.245),
                   mats["secondary"],rig,bone,76,50,tilt=side*.77)
            sphere(slug+" curved ear lining "+str(side),
                   (side*.79,.171,1.77),(.22,.035,.178),
                   inner,rig,bone,54,38,tilt=side*.77)
    else:
        for side in (-1,1):
            # Frontal view: positive X is viewer-left (orange);
            # negative X is viewer-right (cocoa).
            outer = mats["patch"] if side>0 else mats["secondary"]
            triangular_ear(slug+" reference-shaped calico ear "+str(side),
                           side, outer, inner, rig)

def body_and_limbs(slug, rig, mats):
    fur=mats["fur"]
    accent=mats["patch"]
    pink=mats["pink"]
    sphere(slug+" round skinned plush torso", (0,-.08,.80),
           (.41,.345,.46),fur,rig,"Body",42,30)
    sphere(slug+" soft pale belly",(0,.235,.77),
           (.315,.092,.34), mats["belly"],rig,"Body",30,22)
    if slug=="dog":
        sphere(slug+" neck collar", (0,.03,1.11),
               (.34,.34,.074),mats["collar"],rig,"Body",34,16)
        sphere(slug+" little golden collar tag",(0,.393,1.095),
               (.09,.038,.10),mats["gold"],rig,"Body",20,16)
    for side in (-1,1):
        suffix="L" if side<0 else "R"
        # Short plump articulated arms: raised by the actual Arm bones.
        sphere(slug+" lifted paw arm "+suffix,
               (side*.44,.17,1.02),(.19,.19,.245),fur,rig,"Arm_"+suffix,32,20,
               tilt=-side*.24)
        sphere(slug+" plump planted haunch "+suffix,
               (side*.24,-.005,.38),(.21,.19,.27),fur,rig,"Leg_"+suffix,32,22)
        sphere(slug+" tiny rounded foot "+suffix,
               (side*.24,.18,.16),(.235,.265,.165),fur,rig,"Leg_"+suffix,32,22)
        sphere(slug+" heart paw pad "+suffix,
               (side*.24,.434,.16),(.105,.027,.075),pink,rig,"Leg_"+suffix,22,14)
        for digit in (-1,0,1):
            sphere(slug+" paw digit "+suffix+" "+str(digit),
                   (side*.24+digit*.095,.414,.085),
                   (.052,.032,.041),pink,rig,"Leg_"+suffix,16,12)
    if slug=="rabbit":
        sphere(slug+" cotton puff tail",(0,-.46,.77),
               (.22,.23,.22),mats["belly"],rig,"Tail",26,18)
    else:
        line(slug+" curved expressive tail",
             [(0,-.36,.83),(0,-.56,.82),(0,-.72,1.01),
              (.15,-.77,1.18)],.125,accent,rig,"Tail")
        sphere(slug+" ivory fluffy tail tip",
               (.15,-.77,1.18),(.15,.15,.15),mats["belly"],rig,"Tail",20,14)


def animate(slug, rig):
    rig.animation_data_create()
    for activity in ACTIONS:
        action=bpy.data.actions.new(activity)
        rig.animation_data.action=action
        for frame in range(1,END+1,3):
            t=(frame-1)/(END-1)
            cycle=math.tau*t
            for bone in rig.pose.bones:
                bone.rotation_euler=(0,0,0)
                bone.location=(0,0,0)
            root=rig.pose.bones["Root"]
            body=rig.pose.bones["Body"]
            head=rig.pose.bones["Head"]
            jaw=rig.pose.bones["Jaw"]
            tail=rig.pose.bones["Tail"]
            arms=[rig.pose.bones["Arm_L"],rig.pose.bones["Arm_R"]]
            legs=[rig.pose.bones["Leg_L"],rig.pose.bones["Leg_R"]]
            ears=[rig.pose.bones["Ear_L"],rig.pose.bones["Ear_R"]]
            if activity=="Idle":
                body.location.y=.016*math.sin(cycle)
                head.rotation_euler.z=.045*math.sin(cycle)
                tail.rotation_euler.x=.13*math.sin(cycle)
            elif activity=="Walk":
                root.location.y=.023*math.sin(2*cycle)**2
                body.rotation_euler.x=.045*math.sin(2*cycle)
                for i in range(2):
                    legs[i].rotation_euler.x=(1 if i else -1)*.38*math.sin(2*cycle)
                    arms[i].rotation_euler.x=-(1 if i else -1)*.25*math.sin(2*cycle)
                tail.rotation_euler.z=.18*math.sin(2*cycle)
            elif activity=="Play":
                # TWO genuine airborne peaks, with both paws raised.
                root.location.y=.31*math.sin(cycle)**2
                body.rotation_euler.z=.13*math.sin(cycle*2)
                head.rotation_euler.z=.19*math.sin(cycle)
                jaw.rotation_euler.x=.18+.055*math.sin(cycle*4)
                tail.rotation_euler.z=.30*math.sin(cycle*4)
                for i in range(2):
                    arms[i].rotation_euler.x=-.62-.17*math.sin(cycle*2)
                    arms[i].rotation_euler.z=(-1 if i else 1)*.25
                    legs[i].rotation_euler.x=.14*math.sin(cycle*2+(i*math.pi))
                    ears[i].rotation_euler.y=(1 if i else -1)*.12*math.sin(cycle*2)
            elif activity=="Eat":
                reach=math.sin(math.pi*t)**2
                head.rotation_euler.x=-.29*reach
                jaw.rotation_euler.x=.21*max(0,math.sin(cycle*5))*reach
                arms[0].rotation_euler.x=-.31*reach
            elif activity=="Rest":
                root.location.y=-.15
                body.rotation_euler.x=.10
                head.rotation_euler.x=.12
            elif activity=="Groom":
                reach=math.sin(math.pi*t)**2
                arms[0].rotation_euler.x=-.65*reach
                head.rotation_euler.z=.12*reach
                jaw.rotation_euler.x=.10*max(0,math.sin(cycle*4))*reach
            elif activity=="Sniff":
                head.rotation_euler.x=-.16*math.sin(math.pi*t)**2
                head.location.z=.034*math.sin(cycle*3)
            for bone in rig.pose.bones:
                bone.keyframe_insert("location",frame=frame,group=bone.name)
                bone.keyframe_insert("rotation_euler",frame=frame,group=bone.name)
        rig.animation_data.action=None
        track=rig.animation_data.nla_tracks.new()
        track.name=activity
        strip=track.strips.new(activity,1,action)
        strip.action_frame_start=1
        strip.action_frame_end=END
        strip.blend_type="REPLACE"
        track.mute=False


def review(slug, rig, out):
    scene=bpy.context.scene
    scene.render.engine="BLENDER_WORKBENCH"
    scene.display.shading.light="STUDIO"
    scene.display.shading.color_type="MATERIAL"
    scene.display.shading.show_cavity=True
    # Workbench shadow projection from a large floor creates false wedges;
    # grounding is checked in the real WebGL stage, not with fake shadow bands.
    scene.display.shading.show_shadows=False
    scene.render.resolution_x=600
    scene.render.resolution_y=600
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="PNG"
    scene.display.shading.background_type="VIEWPORT"
    scene.display.shading.background_color=(.96,.95,.93)
    scene.render.film_transparent=False
    # Neutral studio colour retains an honest silhouette without adding
    # shadow artifacts to this materials-only Blender review.
    camera_data=bpy.data.cameras.new("Kawaii hero review camera")
    camera=bpy.data.objects.new("Kawaii hero review camera",camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location=(2.4,5.0,2.45)
    look=Vector((0,0,1.24))
    camera.rotation_euler=(look-camera.location).to_track_quat("-Z","Y").to_euler()
    camera_data.type="ORTHO"
    camera_data.ortho_scale=3.40 if slug=="rabbit" else 3.0
    scene.camera=camera
    for name, frame in (("idle",9),("play",13),("jump",37)):
        for track in rig.animation_data.nla_tracks:
            track.mute=track.name!=("Idle" if name=="idle" else "Play")
        scene.frame_set(frame)
        scene.render.filepath=str(out/(slug+"-"+name+"-review.png"))
        bpy.ops.render.render(write_still=True)
    # Neither the camera nor render objects belong to the exported GLB.
    bpy.data.objects.remove(camera,do_unlink=True)


def build(slug,out):
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj,do_unlink=True)
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action,do_unlink=True)
    rig=skeleton(slug)
    base=COLORS[slug]
    mats={
        "fur": material(slug+" creamy fur",base["fur"]),
        "patch": material(slug+" warm markings",base["patch"]),
        "secondary": material(slug+" cocoa accents",base["secondary"]),
        "pink": material(slug+" rosy inner ear and paw",base["inner"]),
        "belly": material(slug+" ivory plush",(.995,.98,.93)),
        "dark": material(slug+" chocolate expression",(.26,.11,.10),.40),
        "blush": material(slug+" soft blush",(.99,.67,.66),.94),
        "nose": material(slug+" coral cat nose",(.96,.36,.36),.51),
        "mouth": material(slug+" joyful mouth",(.38,.065,.085),.44),
        "tongue": material(slug+" coral tongue",(.99,.38,.44),.48),
        "collar": material(slug+" actual leather brown collar",(.36,.20,.14),.60),
        "gold": material(slug+" bell",(.95,.68,.21),.20),
    }
    body_and_limbs(slug,rig,mats)
    face(slug,rig,mats)
    ears(slug,rig,mats)
    animate(slug,rig)
    scene=bpy.context.scene
    scene.frame_set(1)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in scene.objects:
        if obj.type in ("MESH","ARMATURE"):
            obj.select_set(True)
    bpy.context.view_layer.objects.active=rig
    model=out/(slug+".glb")
    bpy.ops.export_scene.gltf(
        filepath=str(model),export_format="GLB",
        use_selection=True,export_animations=True,
        export_nla_strips=True,export_materials="EXPORT",
        export_yup=True,
    )
    if not model.exists() or model.stat().st_size < 24:
        raise RuntimeError("Missing or truncated new 3D chibi candidate: "+slug)
    review(slug, rig, out)
    # Save independently editable Blender scenes with the exact original JPG
    # packed as a viewport image. The reference plate is intentionally added
    # AFTER GLB export, so it is not confused with actual model geometry.
    source = Path(__file__).resolve().parent.parent / "assets/animal-originals" / (slug + ".jpg")
    if not source.is_file():
        raise RuntimeError("Original illustration missing for " + slug)
    original = bpy.data.images.load(str(source), check_existing=False)
    original.pack()
    plate = bpy.data.objects.new("REFERENCE ONLY - original " + slug + " illustration", None)
    bpy.context.scene.collection.objects.link(plate)
    plate.empty_display_type = "IMAGE"
    plate.data = original
    plate.empty_display_size = 2.1
    plate.empty_image_depth = "FRONT"
    plate.location = (-2.25, 0, 1.15)
    plate.rotation_euler.x = -math.pi / 2
    plate.hide_render = True
    for track in rig.animation_data.nla_tracks:
        track.mute = track.name != "Play"
    bpy.context.scene.frame_set(13)
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(out / (slug + ".blend")))
    return {
        "species": slug,
        "status": "EXPERIMENTAL_REVIEW_ONLY",
        "source_reference": "assets/animal-originals/" + slug + ".jpg",
        "editable_blender": slug + ".blend",
        "bytes": model.stat().st_size,
    }


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--output-dir",required=True)
    argv=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
    args=parser.parse_args(argv)
    out=Path(args.output_dir)
    out.mkdir(parents=True,exist_ok=True)
    summary=[]
    for slug in KINDS:
        summary.append(build(slug,out))
    (out/"chibi-manifest.json").write_text(json.dumps(summary,indent=2)+"\n")
    print("CHIBI_REVIEW_CANDIDATES",json.dumps(summary),flush=True)


if __name__=="__main__":
    main()
