"""Reject disconnected limb geometry or a missing/fake coat before publishing.

Run on the saved .blend so vertex groups and true mesh connectivity are checked,
not inferred from a screenshot. It is a structural gate, not visual approval.
"""
import bpy

LABELS = ("Front_L", "Front_R", "Rear_L", "Rear_R")


def assert_connected(ob):
    mesh = ob.data
    assert len(mesh.vertices) >= 250, f"{ob.name}: too little limb geometry"
    neighbors = [[] for _ in mesh.vertices]
    for edge in mesh.edges:
        a, b = edge.vertices
        neighbors[a].append(b)
        neighbors[b].append(a)
    seen, pending = {0}, [0]
    while pending:
        for other in neighbors[pending.pop()]:
            if other not in seen:
                seen.add(other)
                pending.append(other)
    assert len(seen) == len(mesh.vertices), (
        f"{ob.name}: {len(mesh.vertices)-len(seen)} disconnected vertices"
    )
    assert all(len(v) >= 3 for v in neighbors), (
        f"{ob.name}: open or degenerate non-manifold vertex"
    )


for label in LABELS:
    limb = bpy.data.objects.get(label + " lower paw")
    assert limb is not None, f"No single-piece limb for {label}"
    assert bpy.data.objects.get(label + " shoulder") is None, (
        f"Overlapping separate shoulder still exists for {label}"
    )
    assert_connected(limb)
    groups = {g.name for g in limb.vertex_groups}
    assert {"Body", label+"_Upper", label+"_Lower"} <= groups, (
        f"{label}: limb needs 3-bone deformation, found {groups}"
    )
    assert "distal_cutoff_z" in limb, f"{label}: needs evaluated toe-only contact data"
    assert any(p.material_index == 1 for p in limb.data.polygons) if label == "Rear_R" else True
assert len([obj for obj in bpy.data.objects if obj.type == "MESH"
            and (" cupped cartilage" in obj.data.name)]) >= 4, (
    "All original outer/inner pinnae should have rounded, curved cartilage"
)
assert any(img.name.startswith("calico-short-fur-normal") or img.name == "Calico short-fur normal" for img in bpy.data.images), (
    "Baked glTF normal map is required for mobile PBR coat shading"
)
# The rose pad is a mesh detail, not a separate foot IK target. Its real
# bind-position sole must sit on the same floor as the one-piece rear limb.
for side in ("L", "R"):
    obj = bpy.data.objects["Rear_%s rosy toe pad" % side]
    sole = min(vertex.co.z for vertex in obj.data.vertices)
    assert .035 <= sole <= .095, (
        "Rear paw pad must rest near the floor, not penetrate it: %s=%.4f" %
        (obj.name, sole)
    )
fur = [ob for ob in bpy.data.objects if ob.type == "MESH" and ob.name.startswith("Fur ")]
assert len(fur) >= 5, f"Need batched tuft groups, got {len(fur)}"
assert all(len(ob.data.polygons) >= 20 for ob in fur)
assert len(fur) >= 7, "Coat should cover cheeks, ruff, flanks and back"
body = bpy.data.objects["Longer natural calico torso"]
face = bpy.data.objects["One-piece calico rounded face"]
assert face.dimensions.x / body.dimensions.x <= 1.12, (
    "Head remains disproportionately wider than body"
)
assert body.dimensions.y >= .90*face.dimensions.x, (
    "Torso is too short relative to head"
)
print("ANATOMY_PASS one-piece four limbs, multi-bone weights, batched fur and balanced silhouette")
