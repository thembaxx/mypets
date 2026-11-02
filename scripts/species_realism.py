"""Reusable, bounded procedural realism details for MyPets' review-only rigs.

This module improves the dog/rabbit anatomy and mammal PBR surface. It does not
pretend the meshes are photographic scans or biomechanically accurate models.
"""
import math
import struct
import zlib
from pathlib import Path

import bpy
from mathutils import Vector


FURRED = {"dog", "rabbit", "hamster", "guinea-pig", "ferret", "hedgehog"}


def bake_coat_normal(slug, output_dir, size=128):
    """Create an actual tileable, non-black, PNG normal map for glTF PBR."""
    if slug not in FURRED:
        return None
    rgba = bytearray()
    reds, greens = [], []
    for y in range(size):
        rgba.append(0)
        for x in range(size):
            u, v = x / size, y / size
            # Wrapped frequency warps prevent the previous repeating seam.
            dx = .07 * math.sin(math.tau * (u * 27 + .19 * math.sin(math.tau*v*19)))
            dy = .088 * math.sin(math.tau * (v * 43 + .16 * math.cos(math.tau*u*23)))
            n = Vector((-dx, -dy, 1)).normalized()
            pixel = (round(255*(.5+.5*n.x)), round(255*(.5+.5*n.y)),
                     round(255*(.5+.5*n.z)),255)
            reds.append(pixel[0])
            greens.append(pixel[1])
            rgba.extend(pixel)
    if min(max(reds)-min(reds),max(greens)-min(greens)) < 12:
        raise ValueError("Flat fur normal bake")

    def chunk(tag, contents):
        payload=tag+contents
        return (struct.pack(">I",len(contents))+payload+
                struct.pack(">I",zlib.crc32(payload)&0xffffffff))

    png=(bytes((137,80,78,71,13,10,26,10))+
         chunk(b"IHDR",struct.pack(">IIBBBBB",size,size,8,6,0,0,0))+
         chunk(b"IDAT",zlib.compress(bytes(rgba),9))+
         chunk(b"IEND",b""))
    path=Path(output_dir)/(slug+"-coat-normal.png")
    path.write_bytes(png)
    if len(png)<1400:
        raise ValueError("Compressed fur normal PNG is suspiciously small")
    image=bpy.data.images.load(str(path),check_existing=False)
    image.colorspace_settings.name="Non-Color"
    image.pack()
    return image


def shade_coat(material, image):
    if image is None:
        return material
    nodes=material.node_tree.nodes
    links=material.node_tree.links
    texture=nodes.new("ShaderNodeTexImage")
    texture.image=image
    texture.extension="REPEAT"
    normal=nodes.new("ShaderNodeNormalMap")
    normal.inputs["Strength"].default_value=.36
    links.new(texture.outputs["Color"],normal.inputs["Color"])
    links.new(normal.outputs["Normal"],nodes.get("Principled BSDF").inputs["Normal"])
    return material


def sculpt_profile(ob, slug, section, body_length, head_radius):
    """Conservative continuous-vertex torso/skull refinements in bind pose."""
    if slug not in FURRED | {"bird","budgie","canary","chicken","snake","iguana","gecko","salamander"}:
        return
    for vertex in ob.data.vertices:
        p=vertex.co
        if section=="torso":
            t=max(-1,min(1,(p.y+.16)/body_length))
            if slug=="dog":
                p.x *= 1-.15*max(t,0)**2+.025*max(-t,0)
                p.z += .04*t+.016*(1-t*t)
            elif slug=="rabbit":
                p.x *= 1+.16*max(-t,0)-.17*max(t,0)
                p.z += .05*max(-t,0)+.016*(1-t*t)
            elif slug in FURRED:
                p.x *= 1-.07*max(t,0)+.04*max(-t,0)
                p.z += .015*(1-t*t)
            else:
                p.x *= 1-.06*max(t,0)
                p.z += .012*(1-t*t)
        elif section=="skull":
            p.x *= .94
            if slug=="rabbit":
                p.z += .02*(1-min(1,abs(p.x)/head_radius))
            elif slug=="dog":
                p.y += .035*max(0,1-abs(p.x)/head_radius)
            else:
                p.y += .012*max(0,1-abs(p.x)/head_radius)
    ob.data.update()


def joined_limb_profile(slug, fore, side, x, y, hip, knee, radius, ankle):
    """One smooth 7-ring paw/leg with a sculpted hock and forward toe.

    Keep the original upper/lower bone weight blending in the author script;
    change only the contiguous rest-pose surface, not its attachment.
    """
    if slug not in ("dog","rabbit"):
        return None
    backwards=(-.11 if fore else .16 if slug=="rabbit" else .08)
    reach=.31 if slug=="rabbit" and not fore else .19
    points=[(x,y,hip+.14),(x,y,hip),
            (x,y+backwards*.35,knee+.13),
            (x,y+backwards,knee),
            (x,y+backwards*.60,ankle+.17),
            (x,y+reach*.30,ankle+.055),
            (x,y+reach,ankle*.74)]
    radii=[(radius*1.08,radius*1.05),(radius,radius),
           (radius*.89,radius*.82),(radius*.68,radius*.65),
           (radius*.57,radius*.53),(radius*.74,radius*.76),
           (radius*.60,radius*.62)]
    return points,radii


def cupped_pinna(slug, side, face_y, hz, hr, coat, rig, bind):
    """Tapered curved pinna with a connected triangulable cartilage surface."""
    height=.52 if slug=="rabbit" else .25
    width=.13
    x0=side*hr*.77
    n,rings=12,10
    verts=[]
    for row in range(rings):
        t=row/(rings-1)
        radius=width*(.06+.94*(1-t)**.8)
        x=x0+side*(.12 if slug=="rabbit" else .07)*t
        z=hz+hr*.64+height*t
        y=face_y-.08-.055*t
        for i in range(n):
            angle=math.tau*i/n
            verts.append((x+radius*math.cos(angle),
                          y+.055*(1-t)*math.sin(angle)+.022*math.sin(math.pi*t),
                          z))
    faces=[]
    for row in range(rings-1):
        for k in range(n):
            a=row*n+k
            b=row*n+(k+1)%n
            faces.append((a,b,b+n,a+n))
    faces.append(tuple(reversed(range(n))))
    faces.append(tuple((rings-1)*n+i for i in range(n)))
    mesh=bpy.data.meshes.new(slug+" continuous pinna cartilage")
    mesh.from_pydata(verts,[],faces)
    mesh.update()
    ob=bpy.data.objects.new(slug+" cupped ear "+str(side),mesh)
    bpy.context.collection.objects.link(ob)
    mesh.materials.append(coat)
    for face in mesh.polygons:
        face.use_smooth=True
    bind(ob,rig,{"Head":{i:1 for i in range(len(verts))}})
    return ob


def articulated_gait(slug, bone, phase, cycle):
    """Swing-phase knee/hock flex; species-specific hind-leg coordination."""
    if slug=="rabbit" and bone.name.startswith("Rear"):
        phase=0 if bone.name.endswith(("_L_Upper","_L_Lower")) else .12
    swing=math.sin(cycle*2+phase)
    if bone.name.endswith("_Upper"):
        bone.rotation_euler.x=(.24 if slug=="dog" else .29)*swing
    elif bone.name.endswith("_Lower"):
        bone.rotation_euler.x=-(.32 if slug=="rabbit" else .20)*max(0,swing)


def feline_style_eyelid(slug, side, eye_centre, radius, surface, rig, bind):
    """Skinned deforming upper eyelid on terrestrial animals and birds.

    Fish and snakes have no authored eyelid here. Species accuracy remains
    approximate, especially for geckos with different ocular anatomy.
    """
    x0, y0, z0 = eye_centre
    columns = 15
    verts, faces = [], []
    for i in range(columns):
        u = 2 * i / (columns - 1) - 1
        envelope = math.sqrt(max(0, 1-u*u))
        x = x0 + radius * .185 * u
        y = y0 + radius * .087 - radius * .016*u*u
        z = z0 + radius * (.095 + .041*envelope)
        verts.extend(((x,y,z),(x,y,z-radius*.031)))
    for i in range(columns-1):
        k = i*2
        faces.append((k,k+2,k+3,k+1))
    mesh = bpy.data.meshes.new(slug+" eyelid surface")
    mesh.from_pydata(verts,[],faces)
    mesh.update()
    obj = bpy.data.objects.new(slug+(" left" if side<0 else " right")+" upper eyelid",mesh)
    bpy.context.collection.objects.link(obj)
    mesh.materials.append(surface)
    for face in mesh.polygons:
        face.use_smooth = True
    obj.shape_key_add(name="Basis")
    closed = obj.shape_key_add(name="Blink_L" if side<0 else "Blink_R")
    wide = obj.shape_key_add(name="Eye_Wide")
    basis = mesh.shape_keys.key_blocks["Basis"].data
    for i in range(columns):
        u = 2*i/(columns-1)-1
        envelope = math.sqrt(max(0, 1-u*u))
        for part in (0,1):
            k = 2*i+part
            src = basis[k].co
            closed.data[k].co = (src.x,src.y,src.z-radius*.23*envelope)
            wide.data[k].co = (src.x,src.y,src.z+radius*.047*envelope)
    bind(obj,rig,{"Head":{i:1.0 for i in range(len(verts))}})
    return obj
