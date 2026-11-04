# MyPets — image-to-3D + editable Blender character studio

**Status: experimental authoring and interactive previews, not approved character replacements.**

References:

- [Fursund's 3 November 2026 example](https://x.com/fursund/status/2117550901250412957) suggests an image-to-3D route. For the referenced [Speridlabs Idol model](https://github.com/speridlabs/idol-sdk), note that its actual output is a **3D Gaussian-splat PLY**, _not_ a riggable triangle-mesh GLB. [Convert3D](https://convert3d.org/image-to-3d) offers a separate browser image-to-3D workflow, but generated model capability and quality require per-asset verification.
- [Ithielix's 2 November 2026 post](https://x.com/ithielix/status/2117127490208485397) links a seven-minute AI-assisted responsive 3D website tutorial. It informs the interactive viewer, not the modeling or rigging process.

These are _complementary_ tools. A single-image 3D generator can output a mesh and surface appearance, but cannot reliably reconstruct hidden anatomical surfaces or invent real animal biomechanics, rigging, facial shapes and animation from one view.

## What you can try immediately

1. Open `/3d-lab` to inspect the 17 original animal designs using the existing cat candidate plus 16 species-specific rigged Blender GLBs. On interactive pet cards, choose **Explore experimental 3D**.
2. Rotate, pinch-zoom, choose **Walk**, **Eat**, **Play**, **Groom** or **Sniff**, or tap directly on the animal / press **Pet** to trigger its _existing_ authored Play clip when present.
3. Use **Review a downloaded Blender GLB (on-device only)** to inspect any self-contained GLB exported by an image-to-3D generator or Blender. It stays local to the device. A model with no authored animation can be rotated, but cannot genuinely walk or eat.
4. All supplied WebP illustrations remain the default art; personally uploaded pet photos are not sent to Convert3D or assigned a generic species-specific mesh.

## Important: Gaussian splats are visual references, not skeletal characters

Idol's official SDK generates `.ply` files containing 3D Gaussians and an estimated input camera from a single image. It needs a compatible GPU (the official documentation reports roughly 7.2 GB VRAM for inference); this is **not** a standard animated triangle mesh. A Gaussian splat may preserve the look of the source illustration from multiple angles, but cannot be directly skin-weighted to the Blender armature in this repository. Do **not** rename `.ply` to `.glb`, treat its points as watertight geometry, or imply that rigid rotation is organic character animation.

For fidelity work, use the Idol splat as an optional high-detail _visual target_. The animated model still needs a retopologized, textured **mesh** with bones, deforming skin and facial shapes. The current `scripts/import-image3d-blender.py` and the batch workflow accept actual GLB triangle meshes, not Idol PLYs. Follow the supplied chibi illustrations as the final likeness reference, not a generic realistic cat or dog.

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
   - `dog-image3d-{front,three-quarter,side,back}.png` — four real Cycles PBR renders
   - `dog-fidelity-review.html` — original JPG alongside actual Blender multi-angle renders
   - `dog-image3d-review.json` — SHA-256 provenance, model statistics, and whether skin + animation data actually survived export

4. **Artist review and rigging are still required.** If the input has no skeleton and clips, the output is an unanimated mesh. Do not call it a walking/feeding animal. Sculpt missing geometry, retopologize for continuous deforming anatomy, make proper skin weights, add facial morphs and authored species-appropriate actions. Use the existing `scripts/author-calico-rig.py` and `scripts/author-species-rigs.py` as behavior/skin reference sources rather than blindly binding arbitrary model geometry to a rig.
5. Before runtime approval, compare the 3D head, coat pattern, silhouette and motions with the original image, then run actual model validators, mobile/desktop QA and physical device tests. The authoring importer and on-device review no longer enforce an arbitrary 8 MiB/160k-position fidelity budget; structural GLB validity and embedded-only resources remain enforced. The **current static export host** does have a real **25 MiB per-file** deployment check in `scripts/prepare-pwa.mjs`. Do not bypass the actual host limit by silently compressing or down-resing reference-faithful characters: store high-resolution Blender sources separately and plan a user-approved asset hosting solution for any final oversized GLBs. GitHub also imposes its own repository file limits.

## Existing Blender character sources

The procedural species authoring script now also saves an editable `<species>.blend` and packs that animal's original JPG as an **image reference plate**. This is not the same as regenerating geometry from the photo. The existing procedurally generated GLBs are already available in `public/models/candidates/species/`, and the cat in `public/models/candidates/nuzzle-calico-rig.glb`. To regenerate editable species sources when Blender is available:

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

## November 4 continuation — fidelity first, animation preference everywhere

**The original JPG/WebP is the visual specification.** Preserve the exact pet's eye and ear shape, spots, coat markings, facial proportions, pose, material finish and palette. Generated single-view meshes are not guaranteed to match the invisible back, legs or tail. Avoid presenting a generic 3D species model as a source-faithful conversion.

The existing **Settings → Animal animations · 2D and 3D** switch now also applies to `/3d-lab`, where the saved setting is loaded on mount and refreshed on focus/storage updates. When off (or system reduced-motion is on), the studio displays a still 3D model, permits orbit/zoom and original-art comparison, but does not run authored animation clips. It also disables controls that would claim to trigger motion. The preference is stored with the user's existing local app data; no new account or permission is required.

In the studio choose **Compare with original** to keep the supplied illustration visible while rotating the _real_ model, or **Reset front view** for repeatable visual inspection. The original artwork is never baked as a fake flat replacement for missing 3D parts.

### Batch all 17 original pets (once source-derived GLBs exist)

Place independently generated, self-contained high-detail image-to-3D GLBs in one local directory using the original names: `cat.glb`, `dog.glb`, `rabbit.glb`, `angelfish.glb`, and so on. No image or GLB is uploaded by this repository. Then run:

```sh
python3 -m unittest discover -s scripts -p 'test_*image3d*.py' -v
python3 scripts/batch-image3d-blender.py \
  --input-dir /path/to/high-resolution-glbs \
  --output-dir /path/to/review-outputs
```

The batch script records missing source models as **MISSING_GENERATED_GLB**, processes present models through Blender, exports editable `.blend` plus 3D review GLB and four genuine renders, and creates a browser-viewable comparison HTML alongside a JSON manifest. It exits nonzero if any expected species is missing or failed, rather than claiming to have completed all pets. This command is a preparation and QA tool, _not_ automatic image-to-3D inference.

### Visual acceptance criteria before any release

1. Side-by-side compare the original art with the **actual Blender render**, not a generated mockup; verify front facial identity, silhouette and colors.
2. Inspect left/right sides and rear to find asymmetric ears, broken limbs and invented markings, and review topology before retopology or automatic rig-transfer.
3. Preserve high-resolution materials, texture atlases, normal/roughness maps and all editable Blender source detail. Do not decimate solely to meet a historical 8 MiB budget.
4. Demand actual skin weights, working facial shape keys, correct species-specific locomotion, genuine foot-ground contact and distinct eating/play/rest loops; a static generated GLB is not animated.
5. Validate 3D in a real browser and on a physical phone. If a full-resolution GLB exceeds the static host or the phone's available memory, use on-demand progressive delivery and an approved alternate host, with the supplied 2D art as a stable fallback.
6. Keep `approvedTripoModels` empty until individual visual approval and both desktop/mobile QA pass.

**Current status:** The new pipeline and controls are committed as a draft PR; there are no new Convert3D-generated animal meshes attached to this branch, and genuine multi-angle renders of those meshes cannot exist until such input GLBs are provided and Blender executes. Do not claim any animal has already reached original-image fidelity.

### Hosting source-faithful GLBs beyond the current static file limit

The `scripts/prepare-pwa.mjs` static exporter currently rejects files over **25 MiB**, a host constraint rather than an artistic quality target. Never silently downscale the source-quality model to satisfy it. The project now accepts a build-time `NEXT_PUBLIC_MYPETS_3D_ASSET_ORIGIN` to load the distinct candidate GLBs from a separately approved **HTTPS** asset server:

```sh
NEXT_PUBLIC_MYPETS_3D_ASSET_ORIGIN=https://your-approved-asset-origin.example npm run build
```

The server must expose the same `/models/candidates/...` paths and allow cross-origin GET requests from MyPets. When the variable is absent or not HTTPS, existing local candidate paths remain unchanged. A hosting destination is **not** provisioned by this feature, no high-resolution files have been uploaded, and no recurring charges are incurred. The new asset domain must be inspected for privacy, CORS, reliability, licenses and delivery cost before enabling it. Massive GLBs may still exceed an individual device's decoding/GPU memory even when the source is preserved uncompressed; show the original 2D artwork on failure.

Avoid committing oversized binaries into `public/` while the static exporter still has that deployment constraint. Keep the master `.blend` and highest-quality GLB as separate authoring/review assets; ship only explicitly accepted models from a hosting strategy that supports them.

## November 4 actual Blender review results

The offline source-guided procedural cat and dog rigs were generated as real editable Blender assets in [workflow 41853390250](https://github.com/thembaxx/mypets/actions/runs/41853390250). The previous chibi rig renders from an existing workflow and higher-polygon source-inspired chibi candidates were also built in [workflow 41855236783](https://github.com/thembaxx/mypets/actions/runs/41855236783). All retain the original art as source reference, but their shapes still have clear likeness gaps: oversized separate limb balls, angular border between coat materials, flat facial blush, and less dynamic play/jump poses than the artwork. These completed Blender builds prove the pipeline works, **not** the required source-image fidelity.

The real render packs remain unapproved and are not automatically inserted into `approvedTripoModels`. The front view and three-quarter original art comparisons must be reviewed before any final model reaches the production page. Preserve the larger editable .blend files and runtime-optional GLBs rather than forcing a low-detail model simply because of historic 8 MiB budgets.
