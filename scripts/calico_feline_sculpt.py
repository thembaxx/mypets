"""Bounded feline shape refinements for the *experimental* MyPets calico.

Coordinate functions are intentionally Blender-independent so their actual
deformations can be unit-tested before heavy Blender exports. This is not a
photogrammetry reconstruction, simulated anatomy, or a production replacement.
"""
import math


def smoothstep(low, high, value):
    t = min(1.0, max(0.0, (value - low) / (high - low)))
    return t * t * (3.0 - 2.0 * t)


def torso_position(x, y, z):
    """Slight scapular taper, fuller haunch, bounded dorsal shoulder transition."""
    shoulders = smoothstep(.10, .54, y)
    hips = 1.0 - smoothstep(-.95, -.54, y)
    width = 1.0 - .095 * shoulders + .055 * hips
    dorsal = smoothstep(1.13, 1.43, z)
    return x * width, y, z + .013 * shoulders * dorsal


def skull_position(x, y, z):
    """Taper lower muzzle profile without moving jaw, eyes or expression rigs."""
    muzzle = smoothstep(.68, 1.07, y)
    lower_face = 1.0 - smoothstep(1.38, 1.75, z)
    brow = smoothstep(1.83, 2.02, z) * (1.0 - smoothstep(.85, 1.10, y))
    width = 1.0 - .095 * muzzle * lower_face
    return x * width, y, z + .008 * brow


def toe_position(x, y, z, centre_x, hip_y, hip_z):
    """Four slight dorsal toe lobes in the ONE skinned paw mesh.

    Does not move Z, which would invalidate sole contact/stance fitting.
    4 broad undulations across the forward third of the continuous toe.
    """
    forward = smoothstep(hip_y + .12, hip_y + .27, y)
    toe_height = max(0.0, 1.0 - abs(z - (hip_z - .83)) / .13)
    local = (x - centre_x) / .36
    lobes = math.cos(4 * math.pi * local)
    shift = .012 * forward * toe_height * lobes
    return x, y + shift, z


def apply_sculpt(object_, transform):
    if object_.type != "MESH":
        raise TypeError("Refine only existing Blender meshes, never swap 2D art")
    for vertex in object_.data.vertices:
        p = vertex.co
        p.x, p.y, p.z = transform(p.x, p.y, p.z)
    object_.data.update()
    return object_
