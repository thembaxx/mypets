# Replacement animal audit and rollout

## Audit (2026-11-04)

Main already pins the latest compatible Three.js 0.187.0 (confirmed against npm),
R3F 9.8.2 and React 19.3.1. No dependencies were upgraded. All repository paths,
existing Blender authoring/export scripts, 23 GLBs, browser/unit checks, workflows,
PWA cache and PR #58 were reviewed before editing.

PR #58 remains a separate draft: its source-likeness generation work is superseded
by the new quality-first brief. Its useful preference/framing lessons informed this
change, but its generation experiments and unapproved binaries were not merged.
The reviewed Check Nuzzle failure (41865609703) was formatting, not evidence of a
current Actions usage allowance blocker. No inference/Blender Actions were triggered.
The repository uses Next static export and has a real 25 MiB per public-file export
limit. Arbitrary 8 MiB/160k-position intake budgets have been removed; structural
validation remains, including buffer bounds and self-contained textures. Unsupported
compressed extensions are rejected until their actual decoders are configured.

## Release contract

`lib/pet-replacements.ts` represents all 17 categories, including budgie, canary
and angelfish variants. Missing replacements stay explicitly missing. Experimental
replacements are only selectable at `/3d-pets/`. Production resolves only individually
approved, license/structure/visual/browser-verified entries. The existing illustrations
and collection/selection flows remain available. Asset approval is not inferred from
file names or the presence of a rig. The earlier procedural studies remain in `/3d-lab/`.

The new owned-resource viewer loads GLBs lazily and uses the real loaded clip list.
Exact asset aliases take precedence over conservative normalized names. Unsupported
activities are disabled; animation fallback is actual idle or a still pose. No whole
model bobbing, fabricated feeding/play, or physics dependency is added. A single mixer
blends actions and releases bindings on close. Geometries, materials, textures,
ImageBitmaps, skeletons, controls and the local PBR environment are disposed.

Both saved animation-off and reduced-motion settings stop automatic frames while
preserving orbit, zoom and keyboard inspection. The legacy lab now supplies the saved
preference too. Models cannot cover modal headers/controls; portrait and landscape
layouts have separate space for the canvas. Network, rendering and context-loss errors
retain the illustration. Existing WebGL1 `3d-preview.html` is not used for skinned PBR
replacements.

## Local validation of foundation

- Formatting, lint, TypeScript, unit tests, GLB validators and production static build.
- Chromium via Playwright on desktop and mobile viewport: all 17 gallery entries,
  legacy lab real GLB, reduced-motion paused status and no page errors.
- The editable Blender-source and visual/behavioral approval work is a separate
  preview change. Infrastructure checks alone do not approve any animal.

Physical iOS/Android testing is still outstanding. No paid services, GPU provisioning,
or new asset host was purchased. Existing experimental rigs are not being relabeled
as professional replacement animals.
