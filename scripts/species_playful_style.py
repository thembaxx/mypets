"""Reference-guided *original* kawaii-style 3D details for MyPets.

The supplied videos show soft toy-like characters, closed happy eyes, rosy
cheeks, bright open smiles and buoyant actions. These original meshes add
those features to the existing skinned Blender animal rigs. The videos are
visual references, never embedded playback or 3D reconstruction.
"""
import math

HEROES = {"dog", "rabbit", "fish", "angelfish"}
PALETTE = {
    "dog": {"blush": (.99, .57, .62), "tongue": (.99, .39, .47)},
    "rabbit": {"blush": (.98, .61, .68), "tongue": (.99, .38, .50)},
    "fish": {"blush": (.99, .64, .64), "tongue": (.99, .44, .42)},
    "angelfish": {"blush": (.99, .67, .67), "tongue": (.99, .40, .47)},
}


def celebration_height(slug, kind, t):
    """Two buoyant, loop-seam-safe hops; no synthetic foot-plant claim."""
    if not math.isfinite(t) or t < 0 or t > 1:
        raise ValueError("Invalid animation phase")
    peak = (
        .30 if slug == "rabbit"
        else .26 if slug == "dog"
        else .16 if kind == "fish"
        else .10 if kind == "bird"
        else .11
    )
    return peak * math.sin(math.tau * t) ** 2


def blush_position(slug, kind, side, width, length, centre_z, depth, head_radius, head_z):
    """Surface-aligned blush rather than cheek markers hiding inside the head."""
    if side not in (-1, 1):
        raise ValueError("Invalid facial side")
    if kind == "fish":
        return (
            side * width * .68,
            .14,
            centre_z - depth * .08,
        )
    return (
        side * head_radius * (.73 if slug == "dog" else .70),
        length * .63 + head_radius * .77,
        head_z - head_radius * .12,
    )


def decorate(slug, spec, rig, ellipsoid, curve_tube, make_material):
    """Create real skinned, lightweight surfaces; preserve all existing clips."""
    if slug not in HEROES:
        return
    kind, width, length, depth, centre_z, radius, head_z, *_ = spec
    blush = make_material(slug + " joyful rose cheeks", PALETTE[slug]["blush"], .93)
    tongue_color = make_material(slug + " expressive coral tongue", PALETTE[slug]["tongue"], .52)
    cocoa = make_material(slug + " playful smile outline", (.31, .12, .14), .65)
    shine = make_material(slug + " shiny catchlight", (.99, .97, .93), .15)

    face_y = length * .63
    for side in (-1, 1):
        cheek = ellipsoid(
            slug + (" left" if side < 0 else " right") + " rosy cheek",
            blush_position(slug, kind, side, width, length, centre_z, depth, radius, head_z),
            (radius * .17, radius * .045, radius * .11),
            blush, rig, "Head", 20, 12,
        )
        cheek.shape_key_add(name="Basis")
        puff = cheek.shape_key_add(name="Cheek_Puff")
        for source, target in zip(cheek.data.shape_keys.key_blocks["Basis"].data, puff.data):
            target.co.x = source.co.x * 1.15
            target.co.y = source.co.y + radius*.012
            target.co.z = source.co.z

    if kind == "fish":
        # Upturned open smile and warm pink tongue sit on the frontal surface.
        mouth_y = .37
        mouth_z = centre_z - depth * .30
        x_scale = .12
        tongue = ellipsoid(
            slug + " open happy tongue",
            (0, mouth_y + .024, mouth_z - .022),
            (radius*.21, radius*.045, radius*.10),
            tongue_color, rig, "Jaw", 20, 12,
        )
        for side in (-1, 1):
            curve_tube(
                slug + " curved smile corner " + str(side),
                [(side*x_scale*.55, mouth_y, mouth_z-.012),
                 (side*x_scale, mouth_y-.006, mouth_z+.055)],
                .009, cocoa, rig, "Head",
            )
    else:
        # Rounded mouth/tongue are separate from skull geometry, but both
        # follow the face armature and jaw during Play and Eat.
        mouth_y = face_y + radius * (1.43 if slug == "dog" else 1.10)
        mouth_z = head_z - radius * .48
        tongue = ellipsoid(
            slug + " joyful open tongue",
            (0, mouth_y + .028, mouth_z - .048),
            (radius*.15, radius*.04, radius*.13),
            tongue_color, rig, "Jaw", 20, 12,
        )
        for side in (-1, 1):
            curve_tube(
                slug + " upward smile corner " + str(side),
                [(side*radius*.10, mouth_y+.012, mouth_z-.025),
                 (side*radius*.29, mouth_y, mouth_z+.035)],
                .011, cocoa, rig, "Head",
            )
    # Catchlights remain attached to the Head bone and render as actual
    # geometry in the GLB—not baked-on image or browser-only sprites.
    for side in (-1, 1):
        if kind == "fish":
            centre=(side*width*.59, .17, centre_z+depth*.25)
        else:
            centre=(side*radius*.75, face_y+radius*.75, head_z+radius*.25)
        ellipsoid(
            slug + (" left" if side < 0 else " right") + " sparkling eye highlight",
            centre,
            (radius*.047, radius*.021, radius*.055),
            shine, rig, "Head", 12, 10,
        )
    return {"rosy_cheeks": 2, "catchlights": 2, "smile": True}
