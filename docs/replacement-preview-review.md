# Replacement preview: actual inventory and remaining gates

This is a working **experimental preview**, not completion of all 17 animals.
No replacement asset is production-approved. PR #59 merged only the verified
registry/viewer/controller foundation and preference/validation fixes. PR #58's
original-image reconstruction work remains a separate unmerged draft.

## Included real assets

| Category | Actual file and supported animation                                      | Source/master                                                             | Remaining limitations                                                                                                                     |
| -------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Cat      | 2.30 MB GLB, skinned, one 8.7s standing/head/tail clip named `Animation` | kenchoo + guillaume bolis; CC BY 4.0; editable GLB import `.blend`        | No walk/eat/play/rest/touch clips. Imported project is not artist-native source.                                                          |
| Rabbit   | 2.79 MB GLB, skinned; `Guarding`, `Running`, `Jump`, `Sitting.000`       | CDmir + TinyWorlds; CC0; original and PBR-converted editable `.blend`     | No feeding/touch clips. Locomotion is authored in place; ground contact, transitional poses and naturalness still require further review. |
| Bird     | 11.19 MB GLB; custom weighted head/chest `Idle` and `Touch`              | Grab3D / Alexander Popov; CC0; full original and separate rigged `.blend` | AI-assisted Meshy mesh/textures; not handmade professional art. No wing articulation, flight, hopping, eating, blinking or rest.          |

The robin's source contains about 800k triangles and 4k textures. A first 400k
runtime derivative caused a real 60-second software-rendered Chromium timeout.
The revised approximately 100k-triangle derivative retains source-resolution
textures and the untouched full-quality original master outside public assets.
It passed the focused test in 59.9s on this software GPU, so physical-device
performance is **not approved**. This is an asset-specific response to measured
rendering behavior, not an application-wide polygon/size budget.

## All 17 category mappings

| Category   | Replacement state                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------- |
| Cat        | Real animated experimental preview                                                                |
| Dog        | Illustration retained; downloaded low-poly Shiba rejected as below target visual quality          |
| Rabbit     | Real animated experimental preview                                                                |
| Hamster    | Illustration retained; suitable licensed animated replacement not obtained                        |
| Guinea pig | Illustration retained; suitable licensed animated replacement not obtained                        |
| Hedgehog   | Illustration retained; detailed CC0 source inspected locally but static, not shipped as completed |
| Ferret     | Illustration retained; suitable licensed animated replacement not obtained                        |
| Bird       | Real limited-animation experimental robin preview                                                 |
| Budgie     | Illustration retained; distinct mapping fixed for Budgerigar/English budgie                       |
| Canary     | Illustration retained; distinct mapping preserved                                                 |
| Chicken    | Illustration retained; detailed CC0 source inspected locally but static, not shipped as completed |
| Fish       | Goldfish illustration retained; licensed aquarium pack rejected because species were wrong        |
| Angelfish  | Freshwater angelfish illustration retained; no marine fish mislabeling                            |
| Gecko      | Illustration retained; suitable licensed animated replacement not obtained                        |
| Iguana     | Illustration retained; suitable licensed animated replacement not obtained                        |
| Salamander | Illustration retained; suitable licensed animated replacement not obtained                        |
| Snake      | Illustration retained; suitable licensed animated replacement not obtained                        |

Sketchfab pages with a free-download label were not treated as permission to bypass
account requirements. CC BY-NC/SA assets and unlicensed mirrors were not admitted.
Quaternius and Three.js sample birds were researched; their lower-detail style or
wrong species did not satisfy this replacement brief. No paid generation, asset
purchase, GPU provisioning or hosting charge was incurred. Firecrawl exhausted
its connected allowance; direct public source/license verification continued.

## Actual review evidence

`docs/replacement-previews/` contains genuine Blender Cycles renders and browser
screenshots. These were generated from the real shipped geometry; none is an
image-generation mockup. Source and runtime robin renders are separate. Views
were inspected for coherent anatomy/materials, clear eyes, complete silhouettes,
contact shadows and room around ears/tails. Inspection is not a complete animation
or professional quality signoff.

The application exposes only supported actions. Idle/static fallback is truthful;
there is no model-wide bobbing to imitate biological motion. The robin rig deforms
weighted head/chest regions only. Interaction completion now returns both playback
and UI status to an actual idle clip. Static models use demand rendering.

To reproduce local QA after `npm ci` (with `ONNXRUNTIME_NODE_INSTALL_CUDA=skip`):

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run assets:check
npm run build
npm run start
# In another shell, with Playwright installed:
MYPETS_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/test.mjs \
MYPETS_CHROMIUM_EXECUTABLE=/absolute/path/to/chromium \
node /absolute/path/to/playwright/cli.js test --config=playwright.replacements.config.mjs
```

Executed locally: **65/65 unit tests**, **26 GLB files**, **6/6 validator
selfchecks**, formatting, lint, TypeScript and production static build/PWA export.
The replacement browser suite passed **21/21** checks (6.3 minutes) across desktop,
mobile portrait and mobile landscape in real Chromium software WebGL. These include
actual clips, disabled unsupported actions, saved motion-off reloads, pixel-stable
paused rendering, reduced motion, orbit/reset, fallback after network/context loss,
modal focus and repeated canvas teardown. A focused check also covers refitting
a rotated camera after portrait/landscape resize while paused.

The screenshots in `docs/replacement-previews/` were inspected. No individual quality
approval is inferred from these passes. Final executed results are also recorded in the draft PR. Chromium software WebGL is not
physical iPhone/Android QA. Safari replacement-asset testing, sustained GPU memory
profiling, gait/contact/transition review, complete species behavior and individual
quality approval are still outstanding. Existing foundation Chromium/WebKit CI
checks do not approve these new animal binaries. Experimental assets stay unmerged.
