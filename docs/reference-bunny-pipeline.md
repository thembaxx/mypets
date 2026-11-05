# Reference bunny: image-specific rigging pipeline

Status: **UNAPPROVED AUTHORING CANDIDATE, NOT PRODUCTION**.

The user-supplied cream-white, large-headed, wink-eyed bunny is the primary
visual reference. The existing natural rabbit replacement and the older
generic chibi rabbit are not acceptable substitutes. Do not overwrite them.

## Implemented source

- scripts/author-reference-bunny.py: editable Blender model generator with
  multi-bone armature, three-bone ears, independently addressable eye/mouth/
  cheek morph targets, ten actions, GLB and four review renders.
- scripts/validate-reference-bunny.mjs: skeletal, animation and morph contract.
- scripts/validate-reference-bunny.selfcheck.mjs: validator regression checks.
- scripts/audit-reference-bunny.mjs: alpha silhouette diagnostic and overlay.
- lib/bunny/animation-controller.ts: typed animation and emotion controller.
- components/bunny/reference-bunny.tsx: isolated R3F component, not mounted
  in production until approved.

## Current limitations

This is a PROCEDURAL STARTING POINT, not an exact reconstructed bunny.
The original illustration shows only one angle. The unseen side and rear,
mesh topology and proportions remain artist interpretations. The first
procedural draft has some rigid per-mesh body weights and must be
retopologized for continuous deformation before approval. Check eyes,
facial landmarks, subtle blended blush, giant ear shapes, paw pads and
all silhouette proportions against the original reference image.
No screenshots, render approvals or Blender executions are claimed yet.

## Generate the candidate

Run these commands from the repository root with Blender 4.5+ installed:

    python3 -m py_compile scripts/author-reference-bunny.py
    blender --background --factory-startup --python-exit-code 1 \
      --python scripts/author-reference-bunny.py -- \
      --output-dir /tmp/mypets-reference-bunny
    node scripts/validate-reference-bunny.mjs \
      /tmp/mypets-reference-bunny/reference-bunny-candidate.glb
    node scripts/validate-3d-assets.mjs /tmp/mypets-reference-bunny --require-assets
    node --test scripts/validate-reference-bunny.selfcheck.mjs
    npm test

Outputs:
- reference-bunny-master.blend — editable source
- reference-bunny-candidate.glb — experimental rigged GLB
- bunny-front.png / bunny-three-quarter.png / bunny-side.png /
  bunny-back.png and bunny-reference-pose.png — transparent material-aware renders
- reference-bunny-manifest.json — source provenance and approval=false

The uploaded original PNG is not bundled in the GitHub PR. Save a copy of
the attached image in the modelling environment for manual comparison.

## Reference comparison

    node scripts/audit-reference-bunny.mjs \
      /path/to/original-bunny.png \
      /tmp/mypets-reference-bunny/bunny-three-quarter.png \
      /tmp/mypets-reference-bunny/bunny-silhouette-review.png

This produces a colour-coded overlap and intersection-over-union diagnostic.
Silhouette IoU alone DOES NOT certify likeness. Camera angle, pose and framing
must match before the number is meaningful. Review colours, face, paw pads,
lighting, curved ears and plausible depth by eye.

## Required production gates

1. Blender generates both source .blend and valid .glb, round-trip imported
   back into a fresh Blender scene and loaded in Three.js.
2. Ten real independent actions: Idle, Walk, Hop, Sit, LieDown, Sleep, Happy,
   Sad, Play, PetReaction. Poses and transitions actually deform the model.
3. Thirteen facial shape keys: independent eye blinks/widens and brows;
   mouth smile/open/frown; cheek puff; two muzzle raises; nose scrunch.
4. Smooth grounded contact, no abrupt pose snaps, floating feet, eye-glint
   detachments, broken ear segments or visible rigid limbs.
5. Reference-angle beauty render convincingly matches the uploaded bunny.
   Inferred other angles are aesthetically reviewed and internally coherent.
6. Real browser QA on iOS Safari, Android Chrome and desktop, including
   touch/orbit, offline PWA, reduced motion, animation-off, context loss,
   and fallback to the unchanged 2D art.
7. Promote the candidate using explicit asset approval metadata only after
   passing all checks. Keep existing models and original art unchanged.

No structural result alone implies visual approval, and this branch must
remain draft until a genuine Blender run and reference render review.
