# Living animals — 3D production brief

## What is already implemented (prototype)

- Three.js r187 / React Three Fiber live scene for the original cream, orange, and chocolate calico. It uses real geometry and separate head, mouth, tongue, legs, ears, tail and eye meshes, not a flat image or CSS sprite.
- Select **Meet the 3D cat prototype** from an interactive illustration, then choose **Breathe / Walk / Eat / Play / Rest** and **happy / curious / sleepy**. Orbit, pinch-zoom and pause work. A stylized food bowl appears for feeding; the cat lowers its head, chews and licks. Walking steps and moves in world X; a ball uses gravity, floor contact and restitution, and the tail follows a damped spring.
- **Record feeding video (8s)** records the actual browser-rendered WebGL canvas locally with MediaRecorder where supported. No uploading to any service. File format (MP4 or WebM) depends on browser codec support; unsupported iOS/mobile browsers show a readable error. This is video of the live 3D scene, not a pre-generated animation or external clip.
- The supplied illustrations remain the source of truth, and user-uploaded photos never leave the device. The cat is a stylized **interpretation**, not a literal pixel-matched image-to-mesh reconstruction. Physics is an intentionally lightweight approximation: the limb motion is kinematic, not collision-aware inverse kinematics, and does not claim genuine animal biomechanics.
- Existing approved Tripo GLBs remain opt-in per species. Rigged GLBs can now crossfade actions named **Idle, Walk, Eat, Play, Rest** (and synonyms) and respond to available **blink, smile and jaw** morph targets. Missing clips are not synthesized or misrepresented.

## To achieve the requested reference-faithful animation quality

A single picture does not contain the hidden back, limb proportions or anatomy needed for a guaranteed faithful 3D reconstruction. A higher-quality model requires reference review and sculpting. The priority is **cat first**, after approval expand **dog, rabbit, ferret, hamster, guinea pig**, then dedicated avian, fish and reptile locomotion rigs. Never apply a cat walk cycle to a fish or snake.

1. **Reference fidelity:** use public/animals/cat.webp as a front-view design plate; create additional front, 3/4, side, back and neutral-pose guides for the same character; maintain cream body, orange left ear/body patch, chocolate right ear/head/tail, closed curved eyes, red nose, pink mouth/paw pads. Have the visual owner approve views before rigging.
2. **Model:** use Blender and/or privately approved Tripo image-to-3D candidate. Sculpt continuous manifold head/body and separated jaw/eyelid/tongue; make realistic contact surfaces while retaining chibi silhouette. Keep high-poly source separately; retopologize a mobile runtime mesh with texture atlas and roughness maps. Do not automatically send private pet photos to third-party services or incur Tripo credits.
3. **Rig:** pelvis/root, 3-5 spine controls, neck/head, jaw, tongue, ear pair, 2–5 tail bones, shoulder/hip/knee/hock/ankle/paw chains, toe spread. Use quadruped IK and foot-plant targets; add facial shape keys \`Blink_L\`, \`Blink_R\`, \`Eye_Wide\`, \`Jaw_Open\`, \`Lick\`, \`Smile\`, \`Sniff\`, \`Cheek_Puff\`, \`Ear_Back_L\`, \`Ear_Back_R\`. Morph names must map explicitly to the Three.js runtime.
4. **Motion study:** from owned/licensed reference video, block walk with stance vs swing and weight transfer; author distinct locomotion \`Idle\`, \`Walk\`, \`Trot\`, \`Turn\`, \`Sit\`, \`Sleep\`, \`Play\`, \`Pounce\`, \`Eat\`, \`Groom\`, \`Blink\`, \`Look\`, \`Meow\`. Feeding must have approach/plant, neck reach, jaw cycles, tongue scoops, swallow and head recovery, not merely moving the entire 3D image up/down.
5. **Physics:** use a dedicated WASM physics engine (Rapier is one option) for floor, bowl, toys and paw contacts. Integrate spring constraints and collision-aware secondary ear/tail motion; keep rig/IK authoritative for purposeful locomotion. Realistic fur needs additional grooming and level-of-detail tuning; do not start with expensive GPU hair on mobile.
6. **Export:** author each animation as an independent Blender Action and preserve in NLA or correct glTF Actions export mode. Export \`.glb\` with animation, skinning, shape keys, embedded textures. Keep source \`.blend\` for reproducibility. Run existing \`scripts/validate-3d-assets.mjs\` and visual review, including seam-free walking/eating loops.
7. **Approve:** compare front/side/back against original artwork, validate face and jaw deformations, test iPhone Safari and Android GPU, offline behaviour, memory leaks, browser settings, loss of WebGL context, reduced motion, licensing, and 30/60fps frame pacing. Then add \`cat: '/animals/3d/cat.glb'\` to \`lib/tripo-models.ts\` and ship it as an approved appearance-matched asset (which takes priority over the placeholder prototype).

The current repo already contains a **manual** Blender candidate workflow and Tripo candidate process. Neither creates a faithful animal automatically. See [blender-asset-workflow.md](blender-asset-workflow.md), [blender-cloud-studio.md](blender-cloud-studio.md), and [TRIPO_3D.md](TRIPO_3D.md).

## Quality checks

\`\`\`sh
npm ci
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npm run assets:check
\`\`\`

Visual acceptance on actual devices remains essential. The above automated tests do not establish visual fidelity or physics accuracy.

## Safety / privacy

- Never upload a user's pet image or video to model-generation providers without informed consent.
- The original 17 supplied WebPs are unchanged. The 3D demo does not replace existing pet photos.
- Never expose Tripo keys in client bundles, and don't automatically incur paid AI-generation credits.
- In reduced-motion mode the 3D pose freezes and recording is disabled; the original animation toggle also hides the optional viewer.
