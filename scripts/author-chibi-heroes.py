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
        "fur": (.99, .93, .79), "patch": (.72, .43, .27),
        "secondary": (.78, .54, .35), "inner": (.96, .57, .59),
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


def sphere(name, xyz, radii, mat, rig, bone, segments=32, rings=24, tilt=0):
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
        points.append((side*.265 + .15*u,
                       .604 - .045*u*u,
                       1.57 + .105*(1-u*u)))
    eye=line(slug + (" left" if side<0 else " right") + " smiling eye arc",
             points, .021, pigment, rig, "Head")
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
    fur, patch, dark, pink, mouth, tongue = (materials[k] for k in
        ("fur", "patch", "dark", "pink", "mouth", "tongue"))
    sphere(slug+" oversized plush head", (0, .13, 1.44),
           (.58, .47, .56), fur, rig, "Head", 48, 34)
    # A restrained patch conforms to the domed frontal silhouette.
    if slug == "cat":
        sphere(slug+" amber calico forehead", (-.32,.355,1.80),
               (.24,.037,.19), patch, rig,"Head",28,20,tilt=.22)
        sphere(slug+" cocoa calico temple", (.39,.32,1.73),
               (.15,.030,.19), materials["secondary"], rig, "Head")
    elif slug == "dog":
        sphere(slug+" puppy caramel forehead", (-.30,.355,1.79),
               (.26,.037,.21), patch, rig,"Head")
    else:
        sphere(slug+" peach crown patch", (.30,.33,1.85),
               (.22,.035,.17), patch, rig,"Head")

    for side in (-1,1):
        happy_eye(slug, side, dark, rig)
        cheek=sphere(slug+" cheek "+str(side), (side*.38,.54,1.36),
                     (.17,.034,.11), pink, rig, "Head",24,16)
        cheek.shape_key_add(name="Basis")
        puff=cheek.shape_key_add(name="Cheek_Puff")
        for base,target in zip(cheek.data.shape_keys.key_blocks["Basis"].data,puff.data):
            target.co.x=base.co.x*(1+.09)
            target.co.y=base.co.y+.017
        # Sculpted separate muzzle puffs create the plush-toy cheek outline.
        sphere(slug+" muzzle puff "+str(side), (side*.115,.548,1.29),
               (.155,.062,.09), fur, rig,"Head",24,16)

    sphere(slug+" button nose", (0,.622,1.40),
           (.067,.037,.048), dark,rig,"Head",22,14)
    opening=sphere(slug+" joyful open mouth", (0,.596,1.205),
           (.19,.058,.144),mouth,rig,"Jaw",32,24)
    opening.shape_key_add(name="Basis")
    smile=opening.shape_key_add(name="Smile")
    wide=opening.shape_key_add(name="Jaw_Open")
    for basis, target_smile, target_wide in zip(
        opening.data.shape_keys.key_blocks["Basis"].data,smile.data,wide.data
    ):
        edge=min(1.,abs(basis.co.x)/.2)
        target_smile.co.z=basis.co.z+.03*edge
        target_smile.co.x=basis.co.x*1.10
        target_wide.co.z=1.205+(basis.co.z-1.205)*1.30
    sphere(slug+" pink happy tongue",(0,.645,1.137),
           (.105,.027,.058),tongue,rig,"Jaw",22,16)
    # Nose-to-mouth smile bridges are geometry, moving with the Head bone.
    for side in (-1,1):
        line(slug+" upturned smile crease "+str(side),
             [(side*.15,.636,1.235),(side*.23,.590,1.29)],
             .012,dark,rig,"Head")
    return opening


def ears(slug, rig, mats):
    main=mats["patch"] if slug=="dog" else mats["fur"]
    inner=mats["pink"]
    if slug=="rabbit":
        for side in (-1,1):
            bone="Ear_L" if side<0 else "Ear_R"
            sphere(slug+" soft standing ear "+str(side),
                   (side*.43,.06,2.12),(.165,.126,.45),
                   main,rig,bone,32,24,tilt=-side*.18)
            sphere(slug+" warm inner ear "+str(side),
                   (side*.44,.173,2.13),(.105,.035,.34),
                   inner,rig,bone,28,20,tilt=-side*.18)
    elif slug=="dog":
        for side in (-1,1):
            bone="Ear_L" if side<0 else "Ear_R"
            sphere(slug+" floppy soft ear "+str(side),
                   (side*.66,.075,1.57),(.245,.158,.32),
                   main,rig,bone,32,24,tilt=side*.81)
            sphere(slug+" pink floppy ear lining "+str(side),
                   (side*.66,.212,1.54),(.15,.039,.22),
                   inner,rig,bone,28,18,tilt=side*.81)
    else:
        for side in (-1,1):
            bone="Ear_L" if side<0 else "Ear_R"
            sphere(slug+" tapered cat ear "+str(side),
                   (side*.43,.09,1.99),(.19,.13,.315),
                   mats["secondary"] if side>0 else mats["patch"],
                   rig,bone,30,20,tilt=side*.16)
            sphere(slug+" curved pink cat ear inset "+str(side),
                   (side*.43,.205,2.01),(.11,.033,.235),
                   inner,rig,bone,24,16,tilt=side*.16)


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
        "mouth": material(slug+" joyful mouth",(.38,.065,.085),.44),
        "tongue": material(slug+" coral tongue",(.99,.38,.44),.48),
        "collar": material(slug+" festive collar",(.93,.69,.30),.36),
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
