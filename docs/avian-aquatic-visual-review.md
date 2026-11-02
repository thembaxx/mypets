# Avian and aquatic prototype — visual QA, 2 November 2026

**Status: structurally verified, visual realism NOT approved.** These 3D
candidates stay in the optional studio. No `approvedTripoModels` entries
or original WebP illustrations have been changed.

## Actual source-matched Blender review

- [Rig build #41515113579](https://github.com/thembaxx/mypets/actions/runs/41515113579)
  generated and validated 16 distinct animal candidates and uploaded Blender
  review PNGs and source-specific GLBs.
- Primary additions: curled, skinned wing membranes with independently
  animated tip bones; bird toes and body/tail proportions; fish caudal,
  dorsal and pectoral membranes; a single tapered fish body with a
  laterally compressed angelfish profile; corrected attached gill creases.
- The Blender review is **not** motion capture, simulated feather or fish
  tissue, muscle dynamics or photographic reconstruction.
- The generated renders still have **large stylized spherical heads**,
  simple bird legs/eyes and relatively flat or angular fins. Feather
  vanes are an approximated closed surface, not layered feather grooming.
- No approval to replace default pets, no claim of verified real iPhone
  GPU frame rates, and no true eating/contact physics.
- [Anatomical reference for budgerigar flight feathers](https://commons.wikimedia.org/wiki/File:Budgerigar_diagram-labeled.svg)
  and [fish body form comparisons](https://manoa.hawaii.edu/exploringourfluidearth/biological/fish/structure-and-function-fish)
  inform future silhouette reviews; the original MyPets artwork remains
  the visual identity source.

## Release gates

1. Keep candidate rig binaries restricted to `/3d-lab` and preserve 2D art.
2. Require export skin, wing-tip/tail animation channels, fish body
   connectivity, toe meshes and real Blender reviews.
3. Run desktop Chromium, mobile Chromium and WebKit interactions on the
   same branch as published GLB binaries, not stale generated source.
4. Before any default 3D rollout, compare actual original artwork and
   rendered model side-by-side, photographically evaluate each species,
   then independently profile frame pacing and memory on physical phones.
5. Next realism pass: connected cranial/neck mesh, actual layered
   feathers, webbed/segmented fins with skeletal control, foot IK,
   swimming dynamics and consistent material texture mapping.
