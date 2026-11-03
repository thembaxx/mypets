"""Continuous anatomical skull-to-muzzle surface for MyPets terrestrial rigs.

The old models had TWO UV spheres for the skull and muzzle. This constructs
one skinned, closed quad shell instead, with separately authored proportions
for canids, lagomorphs, rodents, mustelids, hedgehogs and lizards.

This is original procedural topology, not a photogrammetry scan. No paid assets.
Blender imports are local so curvature profiles can be unit tested on CI.
"""
import math

LENGTHS = {
    "dog": 1.17,
    "rabbit": 1.09,
    "hamster": 1.15,
    "guinea-pig": 1.17,
    "ferret": 1.55,
    "hedgehog": 1.42,
    "iguana": 1.47,
    "gecko": 1.38,
    "salamander": 1.42,
}
REPTILES = {"iguana", "gecko", "salamander"}
SMALL = {"hamster", "guinea-pig", "hedgehog"}

# u, half-width, dorsal/ventral half-height, centre offset relative to head.
# A true continuous forehead/cheek/nasal bridge and tapered rostrum.
GUIDE = (
    (0.00, .34, .38, -.01),
    (.08, .66, .69, .00),
    (.22, .94, .85, .03),
    (.38, 1.00, .87, .03),
    (.52, .91, .79, .015),
    (.62, .75, .65, -.035),
    (.70, .63, .51, -.095),
    (.78, .53, .39, -.17),
    (.86, .45, .33, -.21),
    (.94, .31, .24, -.24),
    (1.00, .09, .12, -.25),
)


def contour(slug, u):
    """Continuous positive radius skull cross-section, scaled in head radii."""
    if slug not in LENGTHS:
        raise ValueError("Unsupported terrestrial skull: " + slug)
    if not math.isfinite(u) or not 0 <= u <= 1:
        raise ValueError("Invalid skull sample")
    for i in range(len(GUIDE) - 1):
        a, b = GUIDE[i], GUIDE[i+1]
        if u <= b[0] or i == len(GUIDE)-2:
            v = max(0., min(1., (u-a[0]) / (b[0]-a[0])))
            # Continuous with zero slope at the guide samples. This prevents
            # sharp faceted forehead / nasal-bridge transitions.
            v = v*v*(3-2*v)
            w,h,z = (a[k] + (b[k]-a[k])*v for k in (1,2,3))
            break
    if slug == "dog":
        # The reference puppy has a full domed brow, plush cheeks and a
        # short softly rounded rostrum, not a long pointy wolf muzzle.
        w *= 1.08 + .26 * max(0., (u-.57)/.43)
        h *= 1.13 + .11 * max(0., (u-.58)/.42)
        z += .04 * max(0., (.76-u)/.76)
    elif slug == "ferret":
        w *= .83
        h *= .84
    elif slug == "rabbit":
        # Broad soft facial cheeks and a smaller button nose.
        w *= 1.10 + .17 * max(0., (u-.53)/.47)
        h *= 1.08
        z += .035*max(0, (.75-u)/.75)
    elif slug in SMALL:
        w *= .91
        h *= .84 if slug == "guinea-pig" else .91
    if slug in REPTILES:
        w *= 1.07
        h *= .61
        z -= .095
    return (w, h, z)


def head_eye_offset(slug):
    """Lateral eye placement outside the continuous cheek surface."""
    w,_,_ = contour(slug, (.95+.68)/(LENGTHS[slug]+.95))
    return max(.53, w + .045)


def anatomical_skull(slug, face_y, head_z, radius, material, armature, bind):
    """Build one watertight skinned cranium, cheek and muzzle surface."""
    import bpy

    rows, segments = 49, 40
    verts, faces = [], []
    front = LENGTHS[slug]
    for row in range(rows):
        u = row / (rows-1)
        width, height, centre = contour(slug, u)
        y = face_y + radius * (-.95 + (front+.95)*u)
        for k in range(segments):
            theta = 2*math.pi*k/segments
            s = math.sin(theta)
            # Anatomical mandible depth differs from cranial vault height;
            # no separately overlapping muzzle sphere is needed.
            under = .82 if s < 0 else 1.0
            verts.append((radius*width*math.cos(theta), y,
                          head_z + radius*(centre+height*s*under)))
    rear_cap = len(verts)
    verts.append((0, face_y - .95*radius, head_z-.01*radius))
    front_cap = len(verts)
    verts.append((0, face_y + front*radius, head_z-.25*radius))
    for row in range(rows-1):
        for k in range(segments):
            a=row*segments+k
            b=row*segments+(k+1)%segments
            faces.append((a,a+segments,b+segments,b))
    for k in range(segments):
        faces.append((rear_cap, k, (k+1)%segments))
        a=(rows-1)*segments+k
        b=(rows-1)*segments+(k+1)%segments
        faces.append((front_cap,b,a))

    mesh=bpy.data.meshes.new("Continuous "+slug+" skull, cheek, rostrum")
    mesh.from_pydata(verts,[],faces)
    mesh.update()
    ob=bpy.data.objects.new("Skinned "+slug+" skull",mesh)
    bpy.context.collection.objects.link(ob)
    mesh.materials.append(material)
    for p in mesh.polygons:
        p.use_smooth=True
    uv=mesh.uv_layers.new(name="Anatomical head UV")
    for p in mesh.polygons:
        indices=[mesh.loops[li].vertex_index for li in p.loop_indices]
        wrap=any(i%segments==0 for i in indices) and any(i%segments==segments-1 for i in indices)
        for li in p.loop_indices:
            i=mesh.loops[li].vertex_index
            if i >= rows*segments:
                uv.data[li].uv=(.5, 0 if i==rear_cap else 1)
            else:
                uv.data[li].uv=(1.0 if wrap and i%segments==0 else
                                (i%segments)/segments, (i//segments)/(rows-1))
    bind(ob,armature,{"Head":{i:1.0 for i in range(len(verts))}})
    return ob
