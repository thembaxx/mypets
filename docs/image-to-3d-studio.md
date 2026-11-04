# MyPets — image-to-3D + editable Blender character studio

**Status: experimental authoring and interactive previews, not approved character replacements.**

References:

- [Fursund's 3 November 2026 demonstration](https://x.com/fursund/status/2117550901250412957) shows local WebGPU image-to-3D using a model called Idol and links to [Convert3D](https://convert3d.org/image-to-3d).
- [Ithielix's 2 November 2026 post](https://x.com/ithielix/status/2117127490208485397) links a seven-minute AI-assisted responsive 3D website tutorial. It informs the interactive viewer, not the modeling or rigging process.

These are *complementary* tools. A single-image 3D generator can output a mesh and surface appearance, but cannot reliably reconstruct hidden anatomical surfaces or invent real animal biomechanics, rigging, facial shapes and animation from one view.

## What you can try immediately

1. Open `/3d-lab` to inspect the 17 original animal designs using the existing cat candidate plus 16 species-specific rigged Blender GLBs. On interactive pet cards, choose **Explore experimental 3D**.
2. Rotate, pinch-zoom, choose **Walk**, **Eat**, **Play**, **Groom** or **Sniff**, or tap directly on the animal / press **Pet** to trigger its *existing* authored Play clip when present.
3. Use **Review a downloaded Blender GLB (on-device only)** to inspect any self-contained GLB exported by an image-to-3D generator or Blender. It stays local to the device. A model with no authored animation can be rotated, but cannot genuinely walk or eat.
4. All supplied WebP illustrations remain the default art; personally uploaded pet photos are not sent to Convert3D or assigned a generic species-specific mesh.

## Turn an original illustration into an editable Blender candidate

1. For example, start with `assets/animal-originals/dog.jpg`. Use a **supported WebGPU device** to generate a detailed candidate in [Convert3D](https://convert3d.org/image-to-3d). Check its terms and your device's memory limits. This repository does not run Convert3D as a backend or make paid external API calls.
2. Download a self-contained, textured **GLB** (not screenshots, relief-only 2.5D, STL or a video).
3. In a Blender-capable environment with the repository checked out, run:

   ```sh
   python3 -m unittest scripts/test_image3d_glb.py -v
   blender -b --factory-startup --python-exit-code 1 \
     --python scripts/import-image3d-blender.py -- \
     --species dog --input-glb /path/to/generated-dog.glb \
     --output-dir /tmp/mypets-dog-review
   ```

   The importer preflights the binary for embedded-only resources, valid headers, bounded source size and sensible geometry. It imports the **actual GLB** and saves:
   - `dog-image3d-review.blend` — editable Blender project with a packed original-image viewport plate
   - `dog-image3d-review.glb` — source-preserving 3D candidate (not auto-approved)
   - `dog-image3d-review.png` — Blender scene review render
   - `dog-image3d-review.json` — SHA-256 provenance, model statistics, and whether skin + animation data actually survived export

4. **Artist review and rigging are still required.** If the input has no skeleton and clips, the output is an unanimated mesh. Do not call it a walking/feeding animal. Sculpt missing geometry, retopologize for continuous deforming anatomy, make proper skin weights, add facial morphs and authored species-appropriate actions. Use the existing `scripts/author-calico-rig.py` and `scripts/author-species-rigs.py` as behavior/skin reference sources rather than blindly binding arbitrary model geometry to a rig.
5. Before runtime approval, compare the 3D head, coat pattern, silhouette and motions with the original image, then run actual model validators, mobile/desktop QA and physical device tests. The runtime gate limits individual GLBs to 8 MiB and 160,000 vertex positions; the import stage permits larger **authoring** source files, not larger automatic production downloads.

## Existing Blender character sources

The procedural species authoring script now also saves an editable `<species>.blend` and packs that animal's original JPG as an **image reference plate**. This is not the same as regenerating geometry from the photo. The generated GLBs are already available in `public/models/candidates/species/`, and the cat in `public/models/candidates/nuzzle-calico-rig.glb`. To regenerate editable species sources when Blender is available:

```sh
blender -b --factory-startup --python-exit-code 1 \
  --python scripts/author-species-rigs.py -- \
  --output-dir /tmp/mypets-species
```

No imported candidate or procedural model is registered in `approvedTripoModels`. Keep all visual QA and future merges separate from releasing replacement art. GitHub Actions minutes are not assumed to be available; this workflow is runnable locally or on an independently provisioned Blender runner.

## Image-to-3D acceptance gates

- **Identity:** Match each supplied photo's recognizable silhouette, colors, proportions, facial identity and markings.
- **Topology:** Avoid detached legs, floating paws, intersecting tails, collapsed ears and hidden back-side defects.
- **Motion:** Require skeleton + actual skinned vertices + nonempty named clips (or controlled morph targets) and species-specific gait. An animated world transform of a static photograph does not qualify.
- **Quality:** Test 360-degree orbit, close-up fur/feathers/scales, 3/4 view, actual foot-ground contact, action loop seams and feeding pose.
- **Mobile:** Check WebGL fallbacks, Safari and Chromium, GPU memory, reduced-motion preferences, idle pausing, offline caching, touch controls and recording.
- **Release:** No model replaces the 2D source until a human visually approves it and the technical checks pass.
