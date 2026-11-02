"""Offline Blender authoring of original, review-only, species-specific 3D rigs.

These are procedural anatomical studies, not photo-real scans or physical animal
simulation. They intentionally DO NOT change approvedTripoModels or WebP art.
Run: blender -b -t 2 --factory-startup --python-exit-code 1 --python scripts/author-species-rigs.py -- --output-dir /tmp/species
"""
import argparse
import json
import math
import sys
import hashlib
from pathlib import Path

import bpy
from mathutils import Vector
from species_realism import (
    articulated_gait,
    bake_coat_normal,
    cupped_pinna,
    joined_limb_profile,
    sculpt_profile,
    shade_coat,
)

# 13 species beyond the independently authored cat, plus breed/colour variants.
# body width,length,depth; center height; head radius; head height; colours.
CONFIG = {
    "dog":         ("quadruped", .49, .96, .41, 1.01, .34, 1.38, (.70,.49,.30), (.91,.76,.53)),
    "rabbit":      ("quadruped", .40, .72, .40, .76, .29, 1.10, (.80,.74,.67), (.91,.85,.78)),
    "hamster":     ("quadruped", .52, .57, .43, .65, .34, .94, (.85,.55,.28), (.98,.84,.62)),
    "guinea-pig":  ("quadruped", .49, .72, .40, .62, .33, .91, (.68,.45,.30), (.98,.88,.68)),
    "ferret":      ("quadruped", .36, 1.03, .34, .68, .30, 1.04, (.66,.52,.40), (.89,.78,.63)),
    "hedgehog":    ("quadruped", .43, .61, .41, .61, .28, .91, (.57,.40,.31), (.88,.78,.62)),
    "chicken":     ("bird", .52, .62, .59, 1.04, .31, 1.50, (.83,.65,.42), (.98,.84,.58)),
    "bird":        ("bird", .35, .48, .50, 1.17, .27, 1.59, (.26,.57,.76), (.43,.75,.88)),
    "budgie":      ("bird", .35, .48, .50, 1.17, .27, 1.59, (.39,.73,.35), (.82,.89,.41)),
    "canary":      ("bird", .35, .48, .50, 1.17, .27, 1.59, (.96,.77,.19), (.99,.88,.38)),
    "fish":        ("fish", .30, .66, .38, 1.04, .26, 1.10, (.27,.57,.78), (.66,.85,.93)),
    "angelfish":   ("fish", .30, .49, .60, 1.04, .24, 1.10, (.86,.67,.31), (.97,.89,.61)),
    "snake":       ("snake", .27, 1.18, .27, .54, .28, .76, (.39,.57,.32), (.67,.78,.45)),
    "iguana":      ("reptile", .38, .89, .34, .66, .31, .97, (.42,.59,.34), (.68,.76,.49)),
    "gecko":       ("reptile", .31, .64, .28, .56, .25, .81, (.75,.67,.40), (.92,.83,.57)),
    "salamander":  ("reptile", .31, .83, .29, .51, .24, .73, (.36,.39,.40), (.68,.64,.53)),
}
ACTIONS = ("Idle", "Walk", "Eat", "Play", "Rest", "Groom", "Sniff")
FPS, END = 24, 49


def mat(name, color, roughness=.91):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    return m


def weighted(ob, arm, weights):
    # Bind geometry to actual armature joints. Most torso/head objects are
    # rigid; limbs use continuous two-bone deformation in one connected mesh.
    for bone, values in weights.items():
        group = ob.vertex_groups.new(name=bone)
        for index, weight in values.items():
            if weight > .0001:
                group.add([index], weight, "REPLACE")
    modifier = ob.modifiers.new("Actual skeleton skinning", "ARMATURE")
    modifier.object = arm
    ob.parent = arm


def ellipsoid(name, centre, radii, material, arm, bone, seg=32, rings=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings)
    ob = bpy.context.object
    ob.name = name
    ob.location = centre
    ob.scale = radii
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    ob.data.materials.append(material)
    for face in ob.data.polygons:
        face.use_smooth = True
    weighted(ob, arm, {bone:{i:1 for i in range(len(ob.data.vertices))}})
    return ob


def tapered_mesh(name, points, radii, material, arm, upper, lower, body=None):
    """One closed skinned surface, not separate floating upper/lower spheres."""
    count = 24
    verts = []
    for j, point in enumerate(points):
        center = Vector(point)
        rx, ry = radii[j]
        for k in range(count):
            angle = math.tau*k/count
            verts.append(tuple(center + Vector((rx*math.cos(angle),ry*math.sin(angle),0))))
    top = len(verts)
    verts.append(tuple(points[0]))
    bottom = len(verts)
    verts.append(tuple(points[-1]))
    faces = []
    for row in range(len(points)-1):
        for k in range(count):
            a = row*count+k
            b = row*count+(k+1)%count
            faces.append((a,b,b+count,a+count))
    for k in range(count):
        faces.append((top,(k+1)%count,k))
        a = (len(points)-1)*count+k
        faces.append((bottom,a,(len(points)-1)*count+(k+1)%count))
    mesh = bpy.data.meshes.new(name+" continuous surface")
    mesh.from_pydata(verts,[],faces)
    mesh.update()
    ob = bpy.data.objects.new(name,mesh)
    bpy.context.collection.objects.link(ob)
    mesh.materials.append(material)
    for poly in mesh.polygons:
        poly.use_smooth = True
    weights = {upper:{},lower:{}}
    if body:
        weights[body] = {}
    total = len(points)-1
    for i in range(len(verts)):
        t = min(i//count,total)/total
        distal = min(.94,max(.02,(t-.25)/.48))
        proximal = .25*(1-t)**3 if body else 0
        weights[upper][i] = 1-distal-proximal
        weights[lower][i] = distal
        if body:
            weights[body][i] = proximal
    weighted(ob,arm,weights)
    return ob


def curve_tube(name, points, thickness, material, arm, bone):
    curve = bpy.data.curves.new(name,"CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 16
    curve.bevel_depth = thickness
    curve.bevel_resolution = 2
    path = curve.splines.new("POLY")
    path.points.add(len(points)-1)
    for item, p in zip(path.points, points):
        item.co = (*p, 1)
    ob = bpy.data.objects.new(name,curve)
    bpy.context.collection.objects.link(ob)
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.convert(target="MESH")
    ob = bpy.context.object
    ob.data.materials.append(material)
    weighted(ob,arm,{bone:{i:1 for i in range(len(ob.data.vertices))}})
    return ob


def rig_for(slug, spec):
    kind,w,l,depth,cz,hr,hz,*_=spec
    arm = bpy.data.armatures.new(slug+" skeleton")
    rig = bpy.data.objects.new("MyPets_"+slug+"_Armature",arm)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bones = {
        "Root":(None,(0,-.1,.35),(0,-.1,.6)),
        "Body":("Root",(0,-.2,.6),(0,-.15,cz+.35)),
        "Head":("Body",(0,l*.46,hz-.22),(0,l*.53,hz+.20)),
        "Jaw":("Head",(0,l*.58+hr*.7,hz-.1),(0,l*.59+hr*.8,hz-.24)),
        "Tail_1":("Body",(0,-l*.80,cz),(0,-l*1.13,cz+.11)),
        "Tail_2":("Tail_1",(0,-l*1.13,cz+.11),(0,-l*1.52,cz+.16)),
    }
    if kind in ("quadruped","reptile"):
        for fore in (True,False):
            for side in (-1,1):
                name=("Front" if fore else "Rear")+("_L" if side<0 else "_R")
                x=side*w*.80
                y=l*(.54 if fore else -.59)
                hip=cz-depth*.24
                middle=max(.18,hip*.55)
                bones[name+"_Upper"]=("Body",(x,y,hip),(x,y,middle))
                bones[name+"_Lower"]=(name+"_Upper",(x,y,middle),(x,y,.075))
    if kind=="bird":
        for side in (-1,1):
            name="Wing_L" if side<0 else "Wing_R"
            bones[name]=("Body",(side*w*.65,-.02,cz+.10),(side*(w+.34),-.12,cz+.1))
            leg="Leg_L" if side<0 else "Leg_R"
            bones[leg]=("Body",(side*.19,0,cz-.26),(side*.19,.06,.07))
    if kind=="fish":
        for side in (-1,1):
            name="Fin_L" if side<0 else "Fin_R"
            bones[name]=("Body",(side*w*.75,-.24,cz),(side*(w+.27),-.47,cz))
    for name,(parent,head,tail) in bones.items():
        b=arm.edit_bones.new(name)
        b.head=head
        b.tail=tail
        if parent:
            b.parent=arm.edit_bones[parent]
            b.use_connect=False
    bpy.ops.object.mode_set(mode="OBJECT")
    for pose in rig.pose.bones:
        pose.rotation_mode="XYZ"
    bpy.ops.object.select_all(action="DESELECT")
    return rig


def make_animal(slug, spec, rig, output_dir):
    kind,w,l,depth,cz,hr,hz,main,accent=spec
    normal_map=bake_coat_normal(slug,output_dir)
    coat=shade_coat(mat(slug+" coat",main),normal_map)
    light=shade_coat(mat(slug+" pale markings",accent),normal_map)
    dark=mat(slug+" eyes",(.075,.055,.05),.29)
    ear_pink=mat(slug+" ear cartilage",(.80,.49,.49))
    body=ellipsoid("Anatomical "+slug+" torso",(0,-.16,cz),(w,l,depth),coat,rig,"Body",48,32)
    sculpt_profile(body,slug,"torso",l,hr)
    if kind in ("quadruped","reptile"):
        body.data.materials.append(light)
        for polygon in body.data.polygons:
            p=sum((body.data.vertices[i].co for i in polygon.vertices),Vector())/len(polygon.vertices)
            if p.z<cz-.04 and p.y>-.65*l:
                polygon.material_index=1
    face_y=l*.63
    face=ellipsoid("Skinned "+slug+" skull",(0,face_y,hz),(hr,hr*.88,hr*.83),
                   coat if kind in ("reptile","fish","snake") else light,rig,"Head",48,32)
    sculpt_profile(face,slug,"skull",l,hr)
    muzzle_y=face_y+hr*.69
    if kind in ("quadruped","reptile"):
        muzzle_scale=1.40 if slug=="dog" else .75 if slug=="rabbit" else 1
        ellipsoid(slug+" muzzle",(0,muzzle_y+hr*.13*(muzzle_scale-1),hz-hr*.23),
                  (hr*.59,hr*.48*muzzle_scale,hr*.34),light,rig,"Head")
        nose=ellipsoid(slug+" breathing nose",(0,muzzle_y+hr*.39,hz-hr*.20),
                       (hr*.21,hr*.10,hr*.14),dark,rig,"Head",20,12)
    else:
        nose=None
    for side in (-1,1):
        x=side*hr*.53
        eye=ellipsoid(slug+(" left" if side<0 else " right")+" living eye",
                      (x,face_y+hr*.68,hz+hr*.20),
                      (hr*.13,hr*.075,hr*.15),dark,rig,"Head",24,16)
        eye.shape_key_add(name="Basis")
        blink=eye.shape_key_add(name="Blink_L" if side<0 else "Blink_R")
        basis=eye.data.shape_keys.key_blocks["Basis"].data
        centre=sum(v.co.z for v in basis)/len(basis)
        for source,target in zip(basis,blink.data):
            target.co.z=centre+(source.co.z-centre)*.18
    mouth=ellipsoid(slug+" eating mouth",(0,muzzle_y+hr*.30,hz-hr*.48),
                    (hr*.20,hr*.06,hr*.10),dark,rig,"Jaw",20,12)
    mouth.shape_key_add(name="Basis")
    jaw=mouth.shape_key_add(name="Jaw_Open")
    for basis,target in zip(mouth.data.shape_keys.key_blocks["Basis"].data,jaw.data):
        target.co.z=basis.co.z-.035

    if kind=="quadruped":
        for side in (-1,1):
            for fore in (True,False):
                name=("Front" if fore else "Rear")+("_L" if side<0 else "_R")
                x=side*w*.80
                y=l*(.54 if fore else -.59)
                hip=cz-depth*.24
                ankle=.065
                # A rounded, joined paw and limb. Rear haunches are stronger.
                knee=hip*.56
                radius=(w*.29 if fore else w*.36)
                points=[(x,y,hip+.17),(x,y-.025,hip),
                        (x,y-.035,knee+.11),(x,y,knee),
                        (x,y+.09,ankle+.07),(x,y+.14,ankle)]
                radii=[(radius*.90,radius),(radius,radius),
                       (radius*.77,radius*.83),(radius*.61,radius*.67),
                       (radius*.92,radius*1.07),(radius*.75,radius*.95)]
                sculpted=joined_limb_profile(slug,fore,side,x,y,hip,knee,radius,ankle)
                if sculpted is not None:
                    points,radii=sculpted
                tapered_mesh(name+" connected limb",points,radii,coat,rig,
                             name+"_Upper",name+"_Lower","Body")
        if slug=="rabbit":
            for side in (-1,1):
                cupped_pinna(slug,side,face_y,hz,hr,coat,rig,weighted)
        elif slug=="hedgehog":
            # Hundreds of spikes in one batched geometry would be too costly;
            # grouped low-count dorsal quills instead of flat texture sprites.
            for n in range(14):
                x, y = .31*math.sin(n*2.399), -.65+n*.083
                curve_tube(slug+" dorsal quill "+str(n),
                           [(x,y,cz+depth*.81),(x*1.15,y-.06,cz+depth*1.24)],
                           .021,dark,rig,"Body")
        else:
            for side in (-1,1):
                ear_w=.14 if slug=="dog" else .115
                ear_h=.25 if slug=="dog" else .13
                if slug=="dog":
                    cupped_pinna(slug,side,face_y,hz,hr,coat,rig,weighted)
                else:
                    ellipsoid(slug+" ear "+str(side),
                              (side*hr*.79,face_y-.09,hz+hr*.67),
                              (ear_w,.12,ear_h),coat,rig,"Head")
        if slug not in ("hamster","guinea-pig","hedgehog"):
            curve_tube(slug+" tail",[(0,-l*.89,cz),(0,-l*1.13,cz+.10),
                                    (0,-l*1.45,cz+.21)],.075,coat,rig,"Tail_1")
    elif kind=="reptile":
        for side in (-1,1):
            for fore in (True,False):
                name=("Front" if fore else "Rear")+("_L" if side<0 else "_R")
                x=side*w*.74
                y=l*(.48 if fore else -.52)
                z=cz*.80
                footx=x+side*.22
                points=[(x,y,z+.13),(x+side*.06,y,z),
                        (x+side*.13,y,z*.55),(footx,y+.07,.09)]
                radii=[(.125,.13),(.13,.13),(.09,.09),(.07,.09)]
                tapered_mesh(name+" connected limb",points,radii,coat,rig,
                             name+"_Upper",name+"_Lower","Body")
        curve_tube(slug+" long tapered tail",[(0,-l*.81,cz),
                   (0,-l*1.17,cz*.77),(0,-l*1.52,cz*.52),
                   (0,-l*1.91,cz*.34)],.092,coat,rig,"Tail_1")
        if slug=="iguana":
            for i in range(11):
                y=-l*.72+i*.17
                curve_tube(slug+" crest "+str(i),[(0,y,cz+depth*.91),
                      (0,y-.035,cz+depth*1.2)],.017,light,rig,"Body")
    elif kind=="bird":
        for side in (-1,1):
            wing="Wing_L" if side<0 else "Wing_R"
            ellipsoid(slug+" wing "+str(side),
                      (side*w*.85,-.13,cz+.04),
                      (w*.29,l*.57,depth*.62),light,rig,wing,32,20)
            leg="Leg_L" if side<0 else "Leg_R"
            curve_tube(slug+" shin "+str(side),
                       [(side*.19,0,cz-.30),(side*.19,.02,.11),
                        (side*.19,.24,.09)],.044,coat,rig,leg)
        beak=mat(slug+" beak",(.96,.62,.21))
        ellipsoid(slug+" curved beak",(0,face_y+hr*.82,hz-hr*.26),
                  (hr*.25,hr*.40,hr*.20),beak,rig,"Head")
        for i in range(3):
            curve_tube(slug+" tail feather "+str(i),[(.09*(i-1),-l*.84,cz),
                        (.15*(i-1),-l*1.20,cz+.03)],.045,coat,rig,"Tail_1")
    elif kind=="fish":
        # Flat tapered fins remain three-dimensional thickness-bearing meshes.
        for side in (-1,1):
            fin="Fin_L" if side<0 else "Fin_R"
            ellipsoid(slug+" pectoral fin "+str(side),
                (side*w*.88,-.24,cz-.03),(.08,.32,.18),light,rig,fin)
        ellipsoid(slug+" caudal fin",(0,-l*1.12,cz),
                  (w*.80,.12,depth*.70),light,rig,"Tail_2")
        ellipsoid(slug+" dorsal fin",(0,-.18,cz+depth*.91),
                  (.08,l*.44,depth*.43),light,rig,"Body")
        for side in (-1,1):
            curve_tube(slug+" gill "+str(side),
                       [(side*w*.72,face_y*.66,cz+.13),
                        (side*w*.78,face_y*.53,cz-.13)],
                       .017,dark,rig,"Head")
    else:  # snake
        # Rounded elongated trunk and narrow tapered tail; no fake walking legs.
        curve_tube(slug+" unbroken spine",
                   [(0,.55,cz),(0,.31,cz-.12),(.15,.07,cz-.14),
                    (.12,-.36,cz-.11),(-.14,-.78,cz-.16),
                    (-.08,-1.15,cz-.17),(0,-1.54,cz-.20)],
                   .20,coat,rig,"Body")
        curve_tube(slug+" tapered tail",
                   [(-.08,-1.15,cz-.17),(0,-1.54,cz-.20),
                    (.09,-1.99,cz-.24)],.095,light,rig,"Tail_1")
        curve_tube(slug+" forked tongue",
                   [(0,face_y+hr*.90,hz-.16),(0,face_y+hr*1.29,hz-.18),
                    (-.06,face_y+hr*1.49,hz-.17)],.014,ear_pink,rig,"Jaw")
    return body


def animate(slug, spec, rig):
    kind,*_=spec
    rig.animation_data_create()
    for label in ACTIONS:
        action=bpy.data.actions.new(label)
        rig.animation_data.action=action
        for frame in range(1,END+1,4):
            t=(frame-1)/(END-1)
            cycle=math.tau*t
            for pb in rig.pose.bones:
                pb.location=(0,0,0)
                pb.rotation_euler=(0,0,0)
            body=rig.pose.bones["Body"]
            head=rig.pose.bones["Head"]
            tail1=rig.pose.bones["Tail_1"]
            tail2=rig.pose.bones["Tail_2"]
            if label=="Idle":
                body.location.y=.012*math.sin(cycle)
                head.rotation_euler.z=.04*math.sin(cycle)
            elif label=="Walk":
                # Distinct swimming/slithering/wing patterns, not a copied cat gait.
                speed=2 if kind in ("quadruped","reptile") else 3
                body.location.y=.026*math.sin(cycle*speed)
                body.rotation_euler.z=.032*math.sin(cycle*speed)
                tail1.rotation_euler.z=.18*math.sin(cycle*speed)
                tail2.rotation_euler.z=.25*math.sin(cycle*speed+.5)
                for bone in rig.pose.bones:
                    if bone.name.endswith("_Upper"):
                        phase=math.pi if bone.name.endswith("_L_Upper") else 0
                        if bone.name.startswith("Rear"):
                            phase+=math.pi
                        if slug in ("dog","rabbit"):
                            articulated_gait(slug,bone,phase,cycle)
                        else:
                            bone.rotation_euler.x=.25*math.sin(cycle*2+phase)
                    if bone.name.endswith("_Lower") and slug in ("dog","rabbit"):
                        phase=math.pi if bone.name.endswith("_L_Lower") else 0
                        if bone.name.startswith("Rear"):
                            phase+=math.pi
                        articulated_gait(slug,bone,phase,cycle)
                    if bone.name.startswith(("Wing_","Fin_")):
                        bone.rotation_euler.y=.30*math.sin(cycle*3)
                    if bone.name.startswith("Leg_"):
                        bone.rotation_euler.x=.30*math.sin(cycle*2)
            elif label=="Eat":
                ramp=math.sin(math.pi*t)**2
                head.rotation_euler.x=-.27*ramp
                rig.pose.bones["Jaw"].rotation_euler.x=.26*max(0,math.sin(cycle*5))*ramp
            elif label=="Play":
                body.location.y=.055*abs(math.sin(cycle*2))
                body.rotation_euler.z=.09*math.sin(cycle*2)
                head.rotation_euler.z=.13*math.sin(cycle*2)
                tail1.rotation_euler.z=.21*math.sin(cycle*2)
            elif label=="Rest":
                body.location.y=-.05
                head.rotation_euler.x=.09
            elif label=="Groom":
                head.rotation_euler.x=-.13*math.sin(math.pi*t)**2
                head.rotation_euler.z=.12*math.sin(cycle*2)
            elif label=="Sniff":
                head.rotation_euler.x=-.12*math.sin(math.pi*t)**2
                head.rotation_euler.z=.08*math.sin(cycle*3)
            for pb in rig.pose.bones:
                pb.keyframe_insert("rotation_euler",frame=frame,group=pb.name)
                pb.keyframe_insert("location",frame=frame,group=pb.name)
        rig.animation_data.action=None
        track=rig.animation_data.nla_tracks.new()
        track.name=label
        strip=track.strips.new(label,1,action)
        strip.action_frame_start=1
        strip.action_frame_end=END
        strip.blend_type="REPLACE"
        track.mute=False


def render_review(path):
    scene=bpy.context.scene
    scene.render.engine="BLENDER_WORKBENCH"
    scene.display.shading.light="STUDIO"
    scene.display.shading.color_type="MATERIAL"
    scene.display.shading.show_shadows=True
    cam_data=bpy.data.cameras.new("Review camera")
    cam=bpy.data.objects.new("Review camera",cam_data)
    bpy.context.collection.objects.link(cam)
    cam.location=(2.7,4.0,2.2)
    target=Vector((0,0,1))
    cam.rotation_euler=(target-cam.location).to_track_quat("-Z","Y").to_euler()
    cam_data.type="ORTHO"
    cam_data.ortho_scale=3.5
    scene.camera=cam
    scene.render.resolution_x=400
    scene.render.resolution_y=400
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="PNG"
    scene.render.filepath=str(path)
    bpy.ops.render.render(write_still=True)


def build(slug, out):
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob,do_unlink=True)
    for act in list(bpy.data.actions):
        bpy.data.actions.remove(act,do_unlink=True)
    spec=CONFIG[slug]
    rig=rig_for(slug,spec)
    make_animal(slug,spec,rig,out)
    animate(slug,spec,rig)
    bpy.context.scene.frame_set(1)
    bpy.ops.object.select_all(action="DESELECT")
    for ob in bpy.context.scene.objects:
        if ob.type in {"MESH","ARMATURE"}:
            ob.select_set(True)
    bpy.context.view_layer.objects.active=rig
    path=out/(slug+".glb")
    bpy.ops.export_scene.gltf(
        filepath=str(path),export_format="GLB",
        use_selection=True,export_animations=True,
        export_nla_strips=True,export_materials="EXPORT",
        export_yup=True,
    )
    if not path.is_file() or path.stat().st_size>8*1024*1024:
        raise RuntimeError("Missing or oversized species GLB: "+slug)
    rig.animation_data.action=None
    for track in rig.animation_data.nla_tracks:
        track.mute=track.name!="Idle"
    render_review(out/(slug+"-review.png"))
    return {"species":slug,"kind":spec[0],"bytes":path.stat().st_size,
            "sha256":hashlib.sha256(path.read_bytes()).hexdigest(),
            "status":"EXPERIMENTAL_REVIEW_ONLY","clips":list(ACTIONS)}


def main():
    argv=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
    parser=argparse.ArgumentParser()
    parser.add_argument("--output-dir",required=True)
    parser.add_argument("--species",choices=sorted(CONFIG))
    args=parser.parse_args(argv)
    out=Path(args.output_dir).resolve()
    out.mkdir(parents=True,exist_ok=True)
    bpy.context.scene.render.fps=FPS
    results=[build(slug,out) for slug in ([args.species] if args.species else CONFIG)]
    (out/"manifest.json").write_text(json.dumps(results,indent=2)+"\n")
    print("SPECIES_3D_CANDIDATES "+json.dumps(results),flush=True)


if __name__=="__main__":
    main()
