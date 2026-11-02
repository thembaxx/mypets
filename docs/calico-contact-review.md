# Calico 3D contact review

This is a review of the **unapproved** Blender calico candidate on
[PR #37](https://github.com/thembaxx/mypets/pull/37).

## Measured result (2 November 2026)

- Last verified geometry audit: [Blender build #41467111898](https://github.com/thembaxx/mypets/actions/runs/41467111898).
- Stance lower-paw underside: +5.66 to +6.19 mm above the floor.
- Swing lower-paw minimum clearance: +13.36 mm.
- Original worst planted paw penetration: -48.72 mm.
- Stance pink toe-pad range: +8.37 to +98.97 mm; previously
  +18.13 to +149.56 mm before separate hind-paw calibration.
- Feeding mouth to food-centre minimum: **76.34 mm**, improved from
  356.6 mm through a revised head approach and prop alignment.
- Grooming paw to muzzle-centre minimum: 354.74 mm in the verified build.
  A Jacobian-fitted paw reach is currently experimental and not yet verified.

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
