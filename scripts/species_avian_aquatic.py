"""Original low-poly/medium-poly sculpted bird wings and fish fins.

Procedural 3D, *not* photographic reference capture. Surfaces are connected,
closed and skinned to actual Blender armature joints. No image replacement.
"""
import math

import bpy
from mathutils import Vector


def skin(ob, rig, influences):
    for name, weights in influences.items():
        group = ob.vertex_groups.new(name=name)
        for index, amount in weights.items():
            if amount > .00001:
                group.add([index], amount, "REPLACE")
    modifier = ob.modifiers.new("Animated anatomical membrane", "ARMATURE")
    modifier.object = rig
    ob.parent = rig


def closed_surface(name, verts, faces, rig, material, weights):
    mesh = bpy.data.meshes.new(name + " sculpted geometry")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    skin(obj, rig, weights)
    return obj



def fish_body_shell(slug, width, length, depth, height, rig, material):
    """A single fusiform or compressed angelfish body with a genuine tapered tail.

    Rings close around the long axis, rather than placing a sphere-head in front
    of an unrelated sphere-body. Skinned Body/Head/Tail roots allow swimming bend.
    """
    angel = slug == "angelfish"
    rows, sides = 28, 32
    verts, faces = [], []
    for row in range(rows):
        t = row / (rows - 1)
        y = -.16 + length * (-.98 + 1.78 * t)
        profile = math.sin(math.pi * t) ** (.56 if angel else .72)
        radius_x = width * (.07 + .93 * profile) * (.54 if angel else 1)
        radius_z = depth * (.05 + .95 * profile) * (1.30 if angel else .85)
        for j in range(sides):
            angle = math.tau * j / sides
            # A deep, laterally compressed disc in angelfish; a streamlined
            # fusiform shell for ordinary fish. Belly remains convex.
            x = radius_x * math.cos(angle)
            z = height + radius_z * math.sin(angle)
            z += .023 * (t - .5)
            verts.append((x, y, z))
    start_cap = len(verts)
    verts.append((0, -.16 - length * .98, height))
    end_cap = len(verts)
    verts.append((0, -.16 + length * .80, height))
    for row in range(rows - 1):
        for k in range(sides):
            a = row * sides + k
            b = row * sides + (k + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    for k in range(sides):
        faces.append((start_cap, (k+1) % sides, k))
        a = (rows-1) * sides + k
        b = (rows-1) * sides + (k+1) % sides
        faces.append((end_cap, a, b))
    influences = {"Body": {}, "Head": {}, "Tail_1": {}}
    for i in range(len(verts)):
        t = min(i // sides, rows - 1) / (rows - 1)
        tail = .65 * max(0, min(1, (.28-t)/.28))
        head = .25 * max(0, min(1, (t-.82)/.18))
        influences["Body"][i] = 1-tail-head
        influences["Head"][i] = head
        influences["Tail_1"][i] = tail
    return closed_surface("Anatomical " + slug + " torso", verts, faces,
                          rig, material, influences)


def shape_avian_torso(obj, slug, length, centre_height):
    """Trim the chest, taper the rump and give the back a smooth slope."""
    for vertex in obj.data.vertices:
        p = vertex.co
        y = max(-1.0, min(1.0, (p.y + .16) / length))
        p.x *= 1 - .14 * max(y, 0)**2 - .08 * max(-y, 0)
        p.z += .065 * max(y, 0) - .033 * max(-y, 0)
    obj.data.update()


def wing_membrane(slug, side, half_width, body_length, height,
                  rig, material):
    """Curved, connected folding wing, with skinned outer primaries.

    Double-sided shell has real thickness; the trailing edge includes
    modest feather-like scallops without floating planes or intersecting balls.
    Lateral bending is split over root and outer wing-tip bones.
    """
    is_chicken = slug == "chicken"
    span = half_width * (.54 if is_chicken else .78) + .07
    root_x = side * half_width * .73
    root_y = -.07
    rows, chords = 14, 12
    vertices, faces = [], []
    for surface in (-1, 1):
        for i in range(rows):
            t = i / (rows - 1)
            sx = root_x + side * span * t
            # Folded flight feathers sweep back alongside the torso, rather
            # than extending sideways like an extra pair of thin arms.
            chord = body_length * (.37 - .21 * t) * math.sin(math.pi * (.16 + .78 * t))**.7
            rear_scallop = .012 * math.sin(math.pi * 6 * t)**2 * t
            for j in range(chords):
                u = j / (chords - 1)
                y = root_y - body_length * (.72 if is_chicken else .98) * t
                y += (u - .45) * chord - rear_scallop * u
                z = height + .07 * math.sin(math.pi * t) - .10 * t
                z += surface * (.015 + .018 * math.sin(math.pi * u)) * (1 - .76 * t)
                vertices.append((sx, y, z))
    layer = rows * chords
    for surface in (0, 1):
        offset = surface * layer
        for i in range(rows - 1):
            for j in range(chords - 1):
                a = offset + i * chords + j
                b = a + chords
                c = b + 1
                d = a + 1
                faces.append((a, b, c, d) if surface == 0 else (d, c, b, a))
    # Seal four outline edges; top and bottom share no exposed boundary.
    for i in range(rows - 1):
        for edge in (0, chords - 1):
            a = i * chords + edge
            b = (i + 1) * chords + edge
            faces.append((a, b, b + layer, a + layer))
    for j in range(chords - 1):
        a, b = j, j + 1
        faces.append((a, b, b + layer, a + layer))
        a, b = (rows - 1) * chords + j, (rows - 1) * chords + j + 1
        faces.append((a, b, b + layer, a + layer))
    base, tip = ("Wing_L" if side < 0 else "Wing_R"), (
        "Wing_L_Tip" if side < 0 else "Wing_R_Tip"
    )
    weights = {base: {}, tip: {}}
    for vertex in range(len(vertices)):
        t = (vertex % layer) // chords / (rows - 1)
        tip_weight = max(0.0, min(.97, (t - .24) / .64))
        tip_weight = tip_weight * tip_weight * (3 - 2 * tip_weight)
        weights[base][vertex] = 1 - tip_weight
        weights[tip][vertex] = tip_weight
    return closed_surface(slug + " continuous feathered wing " +
                          ("left" if side < 0 else "right"),
                          vertices, faces, rig, material, weights)


def fin_membrane(slug, label, origin, reach, height, rig, material,
                 bone, direction="tail"):
    """Watertight fin with scalloped soft silhouette and subtle surface camber.

    True finite-thickness swept surface: tail, dorsal and pectoral fin
    geometries are not resized ellipsoids or flat image planes.
    """
    sections, width_steps = 11, 13
    verts, faces = [], []
    ox, oy, oz = origin
    for surface in (-1, 1):
        for i in range(sections):
            t = i / (sections - 1)
            for j in range(width_steps):
                u = 2*j/(width_steps - 1) - 1
                spread = (height * (.12 + .88 * t)) * u
                edge = .016 * t * (math.sin(4 * math.pi * u)**2)
                taper = .020 + .014 * math.sin(math.pi * t)
                if direction == "tail":
                    x = ox + surface * taper * (1 - .72 * t)
                    y = oy - reach * t - edge
                    z = oz + spread
                elif direction == "dorsal":
                    x = ox + surface * taper * (1 - .75 * t)
                    y = oy + spread
                    z = oz + reach * t - edge
                else:  # pectoral
                    x = ox + reach * t * (-1 if ox < 0 else 1)
                    y = oy + spread
                    z = oz + surface * taper * (1 - .78 * t)
                verts.append((x, y, z))
    layer = sections * width_steps
    for surface in (0, 1):
        offset = surface * layer
        for i in range(sections - 1):
            for j in range(width_steps - 1):
                a = offset + i * width_steps + j
                b = a + width_steps
                c = b + 1
                d = a + 1
                faces.append((a, b, c, d) if surface == 0 else (d, c, b, a))
    for i in range(sections - 1):
        for edge in (0, width_steps - 1):
            a = i * width_steps + edge
            b = (i + 1) * width_steps + edge
            faces.append((a, b, b + layer, a + layer))
    for j in range(width_steps - 1):
        a, b = j, j + 1
        faces.append((a, b, b + layer, a + layer))
        a = (sections - 1) * width_steps + j
        b = a + 1
        faces.append((a, b, b + layer, a + layer))
    return closed_surface(slug + " sculpted " + label, verts, faces,
                          rig, material, {bone: {i: 1.0 for i in range(len(verts))}})


def specimen_fins(slug, half_width, body_length, body_depth,
                  body_height, rig, material):
    is_angel = slug == "angelfish"
    tail_reach = .54 if is_angel else .39
    fin_membrane(slug, "caudal fin", (0, -body_length * 1.05, body_height),
                 tail_reach, body_depth * (1.02 if is_angel else .76),
                 rig, material, "Tail_2")
    fin_membrane(slug, "dorsal fin", (0, -.17, body_height + body_depth * .77),
                 body_depth * (.83 if is_angel else .54),
                 body_length * .38, rig, material, "Body", "dorsal")
    for side in (-1, 1):
        fin_membrane(slug, "pectoral fin " + str(side),
                     (side * half_width * .79, -.23, body_height - .05),
                     half_width * .82, body_length * .26, rig, material,
                     "Fin_L" if side < 0 else "Fin_R", "pectoral")
