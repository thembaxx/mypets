# Tripo 3D for Nuzzle

Nuzzle's existing 17 animal WebP illustrations are authoritative. An image-to-3D generator infers geometry and textures and **cannot guarantee pixel-exact silhouette, proportions or colour**. Keep original images in normal views. 3D is an optional, separate viewer, enabled individually only for approved models. User-uploaded pet photos never go to Tripo.

## Manual, credit-bearing generation

Tripo API calls need a private API key and can consume paid credits. This workflow must NEVER run automatically in CI or in the browser.

1. Obtain an API key at https://developers.tripo3d.ai/en/keys and check your balance.
2. Review the source image in public/animals/. Only submit an asset that you can share with Tripo.
3. Run: TRIPO_API_KEY=your-key node scripts/tripo-generate.mjs dog --confirm-credits
4. Optional: set TRIPO_SOURCE_BASE_URL to your public deployment origin.
5. The candidate .glb and preview are saved to gitignored assets/tripo-candidates/. Review original front-facing proportions, colours, boundaries, eyes, tails and details. Reject any mismatches.
6. Optimize accepted GLBs for mobile and put them in public/animals/3d/. Add a vetted asset path to the approvedTripoModels map in lib/tripo-models.ts, for example: dog: '/animals/3d/dog.glb'. This is the only way a 3D button becomes visible.
7. For living/rigged movement, see Tripo rig-check and rig docs (non-humanoid model v2.5-20260210): https://developers.tripo3d.ai/en/docs/animations-rig. Include animations inside the approved GLB. The built-in viewer can play the first clip and supports orbit/pinch.

## Validation

Check original artwork remains untouched. Confirm static mode instantly removes animal motion and hides the 3D viewer link, including after reload. Honor reduced-motion. Test 3D load failure and offline fallback, mobile GPU performance, file size and the on-demand browser download. Never store the API key in NEXT_PUBLIC variables or track candidate models in Git.

Official generation docs: https://developers.tripo3d.ai/en/docs/generation-image-to-model
