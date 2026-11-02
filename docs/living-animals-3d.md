# Living animals — 3D production brief

## Rigged Blender calico candidate (unapproved)

The Blender authoring pipeline in `scripts/author-calico-rig.py` now creates an actual skinned GLB and an editable `.blend` source. The exported character has **Idle, Walk, Eat, Play, Rest, Groom, Sniff** animation clips, separate leg chains, animated neck/head/jaw/tongue/tail/ears, plus **Blink_L, Blink_R, Eye_Wide, Jaw_Open, Lick, Smile, Cheek_Puff, Sniff** facial shapes. The sculpt's torso, ruff, face and limbs now use smoothly blended multi-bone skin weights. The GLB validator checks actual binary joint weights, not just skeleton declarations. `scripts/verify-calico-rig.mjs` validates the binary's exported skin, clips and morph targets, not merely animation source text. `.github/workflows/rigged-calico-candidate.yml` builds in offline Blender, checks limits, renders front, side, 3/4, eating and walking snapshots, and exports a genuine 49-frame H.264 feeding preview with a review-only food bowl.

The workflow uploads a `nuzzle-calico-rigged-review` pack containing `.blend`, `.glb`, `.json`, preview PNGs and a short `.mp4`; it only commits an **unapproved** GLB to `public/models/candidates/` on this isolated feature branch after pipeline checks pass. It does **not** register the candidate in `approvedTripoModels`, deploy it as the default animal, or merge the PR.

### Review on iPhone without a computer

1. Open **[MyPets PR #37](https://github.com/thembaxx/mypets/pull/37)** and the latest successful **Rigged calico candidate build** under Actions. Download `nuzzle-calico-rigged-review` from the workflow artifacts and unzip with iOS Files.
2. On the MyPets feature preview, open the existing interactive cat and choose **Meet the 3D cat prototype**. Select **Preview rigged Blender cat (experimental)** to load the branch's GLB, or **Review a downloaded Blender GLB (on-device only)** and pick the `.glb` from Files.
3. Try **Breathe, Walk, Eat, Play, Rest**, the facial expression selector, pinch zoom, rotation and pause. Where supported, **Record feeding video (8s)** captures the actual WebGL scene. Local model imports enforce the app's 8 MiB, external-URL and geometry limits. The chosen file stays on device.
4. Compare the screenshots and live model with `public/animals/cat.webp` before approving appearance. Look for correct orange/chocolate patches and ear positions, facial resemblance, real foot contact, neck reach to bowl, cheeks/eyes and smooth animation loop seams.

The walking cycle combines an analytical two-link gait with bounded stance correction from Blender's actual evaluated skinned paw meshes. The geometry audit samples real paw undersides across the gait and records the nose-to-food and grooming-paw-to-muzzle distances in `calico-geometry-contact.json`. The latest sampled walking candidate placed stance paws 5.66–6.19 mm above the floor (previously as low as 48.72 mm below). CI now rejects candidate publication if sampled stance paws penetrate or hover beyond the validation tolerance. Ground-contact shadows in the Three.js studio make visual inspection easier. This is authored geometry correction, **not** a force simulation, collision-aware gait, or world-locked foot-planting system.

**Known fidelity gap:** this generated skinned quadruped remains a procedural, stylized candidate with some continuous, multi-bone deforming surfaces but separate overlapping mesh parts and approximate two-bone gait. It is not a single watertight skinned character, body/fur physics simulation, truly collision-resolving quadruped IK, or exact photo reconstruction. Actual paw-underside ground contact is now measured and bounded during sampled walking frames, but the decorative pink toe pads can still float well above the floor. Continuous contact across arbitrary blended clips, real gait weight transfer and collisions with scene props are not implemented. The animated eating video is real 3D output, but does not prove the movements are biologically realistic. Grooming and sniffing are keyframed, non-physical behaviours with responsive nose, cheek and smile morphs. Neither demonstrates contact-aware anatomy or photorealistic fur. A manual Blender character-artist retopology/refinement stage and real-device review are still required before default release.

## What is already implemented (prototype)

- Three.js r187 / React Three Fiber live scene for the original cream, orange, and chocolate calico. It uses real geometry and separate head, mouth, tongue, legs, ears, tail and eye meshes, not a flat image or CSS sprite.
- Select **Meet the 3D cat prototype** from an interactive illustration, then choose **Breathe / Walk / Eat / Play / Rest / Groom / Sniff** and **happy / curious / sleepy**. Orbit, pinch-zoom and pause work. A stylized food bowl appears for feeding; the cat lowers its head, chews and licks. Walking steps and moves in world X; a ball uses gravity, floor contact and restitution, and the tail follows a damped spring.
- **Record feeding video (8s)** records the actual browser-rendered WebGL canvas locally with MediaRecorder where supported. No uploading to any service. File format (MP4 or WebM) depends on browser codec support; unsupported iOS/mobile browsers show a readable error. This is video of the live 3D scene, not a pre-generated animation or external clip.
- The supplied illustrations remain the source of truth, and user-uploaded photos never leave the device. The cat is a stylized **interpretation**, not a literal pixel-matched image-to-mesh reconstruction. Physics is an intentionally lightweight approximation: the limb motion is kinematic, not collision-aware inverse kinematics, and does not claim genuine animal biomechanics.
- Existing approved Tripo GLBs remain opt-in per species. Rigged GLBs can now crossfade actions named **Idle, Walk, Eat, Play, Rest, Groom, Sniff** (and synonyms) and respond to available **blink, smile and jaw** morph targets. Missing clips are not synthesized or misrepresented.

## To achieve the requested reference-faithful animation quality

A single picture does not contain the hidden back, limb proportions or anatomy needed for a guaranteed faithful 3D reconstruction. A higher-quality model requires reference review and sculpting. The priority is **cat first**, after approval expand **dog, rabbit, ferret, hamster, guinea pig**, then dedicated avian, fish and reptile locomotion rigs. Never apply a cat walk cycle to a fish or snake.

1. **Reference fidelity:** use public/animals/cat.webp as a front-view design plate; create additional front, 3/4, side, back and neutral-pose guides for the same character; maintain cream body, orange left ear/body patch, chocolate right ear/head/tail, closed curved eyes, red nose, pink mouth/paw pads. Have the visual owner approve views before rigging.
2. **Model:** use Blender and/or privately approved Tripo image-to-3D candidate. Sculpt continuous manifold head/body and separated jaw/eyelid/tongue; make realistic contact surfaces while retaining chibi silhouette. Keep high-poly source separately; retopologize a mobile runtime mesh with texture atlas and roughness maps. Do not automatically send private pet photos to third-party services or incur Tripo credits.
3. **Rig:** pelvis/root, 3-5 spine controls, neck/head, jaw, tongue, ear pair, 2–5 tail bones, shoulder/hip/knee/hock/ankle/paw chains, toe spread. Use quadruped IK and foot-plant targets; add facial shape keys `Blink_L`, `Blink_R`, `Eye_Wide`, `Jaw_Open`, `Lick`, `Smile`, `Sniff`, `Cheek_Puff`, `Ear_Back_L`, `Ear_Back_R`. Morph names must map explicitly to the Three.js runtime.
4. **Motion study:** from owned/licensed reference video, block walk with stance vs swing and weight transfer; author distinct locomotion `Idle`, `Walk`, `Trot`, `Turn`, `Sit`, `Sleep`, `Play`, `Pounce`, `Eat`, `Groom`, `Blink`, `Look`, `Meow`. Feeding must have approach/plant, neck reach, jaw cycles, tongue scoops, swallow and head recovery, not merely moving the entire 3D image up/down.
5. **Physics:** use a dedicated WASM physics engine (Rapier is one option) for floor, bowl, toys and paw contacts. Integrate spring constraints and collision-aware secondary ear/tail motion; keep rig/IK authoritative for purposeful locomotion. Realistic fur needs additional grooming and level-of-detail tuning; do not start with expensive GPU hair on mobile.
6. **Export:** author each animation as an independent Blender Action and preserve in NLA or correct glTF Actions export mode. Export `.glb` with animation, skinning, shape keys, embedded textures. Keep source `.blend` for reproducibility. Run existing `scripts/validate-3d-assets.mjs` and visual review, including seam-free walking/eating loops.
7. **Approve:** compare front/side/back against original artwork, validate face and jaw deformations, test iPhone Safari and Android GPU, offline behaviour, memory leaks, browser settings, loss of WebGL context, reduced motion, licensing, and 30/60fps frame pacing. Then add `cat: '/animals/3d/cat.glb'` to `lib/tripo-models.ts` and ship it as an approved appearance-matched asset (which takes priority over the placeholder prototype).

The current repo already contains a **manual** Blender candidate workflow and Tripo candidate process. Neither creates a faithful animal automatically. See [blender-asset-workflow.md](blender-asset-workflow.md), [blender-cloud-studio.md](blender-cloud-studio.md), and [TRIPO_3D.md](TRIPO_3D.md).

## Quality checks

```sh
npm ci
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npm run assets:check
```

Visual acceptance on actual devices remains essential. The above automated tests do not establish visual fidelity or physics accuracy.

## Safety / privacy

- Never upload a user's pet image or video to model-generation providers without informed consent.
- The original 17 supplied WebPs are unchanged. The 3D demo does not replace existing pet photos.
- Never expose Tripo keys in client bundles, and don't automatically incur paid AI-generation credits.
- In reduced-motion mode the 3D pose freezes and recording is disabled; the original animation toggle also hides the optional viewer.
