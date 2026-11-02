# Calico 3D contact review

## Next candidate iteration — anatomy and coat (unverified until Blender CI finishes)

- One manifold tapered limb per leg replaces separate shoulder/shin/paw spheres. Existing upper/lower bones and locomotion remain; toe contact and grooming fit now examine only distal vertices, not the whole limb centre.
- Torso length, head width and eye size are adjusted toward more natural cat proportions. Subtle exported geometric surface relief and batched volumetric tufts improve the coat silhouette without heavy transparent hair cards.
- New Blender structural audit rejects disconnected legs and missing multi-bone weights; GLB checker blocks regressions to floating shoulder meshes.
- **Not photorealistic fur or a photo-faithful pet reconstruction.** The updated export and rendered screenshots must pass workflow gates and human visual review; the earlier contact figures below describe the *previous* candidate only.


This is a review of the **unapproved** Blender calico candidate on
[PR #37](https://github.com/thembaxx/mypets/pull/37).

## Latest visual and facial validation (2 November 2026)

- [Blender sculpt and review build #41476719499](https://github.com/thembaxx/mypets/actions/runs/41476719499)
  passed rig, mesh-contact, binary GLB and real rendered-preview checks.
- [Nuzzle checks #41476730785](https://github.com/thembaxx/mypets/actions/runs/41476730785)
  and [Chromium/WebKit browser QA #41476730691](https://github.com/thembaxx/mypets/actions/runs/41476730691)
  passed for the authored revision.
- Updated rounded-head proportions, slimmer forelimbs, thin swept ears,
  subtler cheeks and muzzle, a curled tail and curved whiskers. These are
  **stylized sculpt improvements**, not a realistic retopologized cat.
- Fixed a severe facial animation bug: the previous exported `Eye_Wide`
  target displaced vertices up to **5.744 m**, and `Blink` displaced them
  **1.580 m**. The reviewed GLB now limits `Eye_Wide` to **0.0765 m**,
  `Blink` to **0.0792 m**, `Jaw_Open` to **0.0731 m** and `Lick`
  to **0.0432 m**. Blender and binary GLB verification now reject
  oversized facial movements.
- The review's evaluated skinned geometry keeps the lowest walking paw
  **5.76 mm above the floor**; closest grooming surface gap is **4.95 mm**
  with maximum forearm separation **10.02 mm**. Feeding mouth-to-food
  centre remains **76.34 mm**.

**Still needs visual approval:** ear shape, exposed seams between the
separate paw/leg sections, tail profile and general toy-like anatomy.
The GLB remains an optional candidate and must not replace the original
cat illustration as the default pet.

## Measured result (2 November 2026)

- Last verified geometry audit: [Blender build #41467111898](https://github.com/thembaxx/mypets/actions/runs/41467111898).
- Stance lower-paw underside: +5.66 to +6.19 mm above the floor.
- Swing lower-paw minimum clearance: +13.36 mm.
- Original worst planted paw penetration: -48.72 mm.
- Stance pink toe-pad range: +8.37 to +98.97 mm; previously
  +18.13 to +149.56 mm before separate hind-paw calibration.
- Feeding mouth to food-centre minimum: **76.34 mm**, improved from
  356.6 mm through a revised head approach and prop alignment.
- Verified grooming geometry: [Blender workflow #41471780983](https://github.com/thembaxx/mypets/actions/runs/41471780983).
  The deformed paw-to-muzzle **centre** distance at peak grooming dropped from
  354.74 mm to **4.31 mm**. The nearest measured mesh vertices are **6.32 mm**
  apart, and the maximum paw-to-forearm surface separation across sampled
  grooming frames is **11.50 mm**.
- The grooming pose is still stylized and manually authored; near-contact alone
  does not establish realistic limb bending or physical collision response.

These are evaluated **deformed mesh** measurements. They are not bone-tip
estimates. The recorded frame sample includes the loop seam; it does not
guarantee continuous physical contact at every interpolated animation frame.
The feeding and grooming distances use mesh centres and do not measure
surface-to-surface separation.

## Verification and release gate

The Blender pipeline now runs `scripts/audit-calico-contact.py`, writes
`calico-geometry-contact.json`, and rejects candidate publication when the
sampled stance undersides fall outside -10 to +25 mm or a swinging paw goes
below -10 mm. The review artifact also contains the editable Blender source,
GLB, seven actions, front/side/three-quarter stills and a real feeding video.

The new Three.js studio renders mesh-based contact shadows. Chromium and
WebKit desktop/mobile interaction checks are separate from the Blender
geometry checks.

**Not production approved.** The cat is a stylized, overlapping-mesh
prototype. Proper toe pads, weight transfer, contact-aware grooming/feeding,
continuous gait verification, more faithful sculpting and a manual review are
required before replacing any original illustration.
