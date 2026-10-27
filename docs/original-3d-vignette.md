# Original 3D vignette — MyPets

- Asset: `public/models/original/mypets-paw-charm.glb` (glTF 2.0, original ChatGPT procedural geometry, **not Blender-rendered**).
- No paid APIs, scraped models, external artist licensing or endorsements.
- Integrated only in the ambient toys layer. The original animal illustrations remain unchanged. If the model is not available offline or fails to load, the existing procedural paw stays visible.
- The context pause control and reduced-motion preference remain authoritative; low-power devices retain their WebGL fallback.
- The asset is deliberately not added to `approvedTripoModels`: it is a charm, not a substitute for a species-specific animated animal.
- Run `npm run assets:check`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test` and `npm run build` when runners are available; visually verify iPhone-sized layouts before claiming full QA. GitHub Actions capacity failures do not imply checks passed.

## Inspect and export on a phone

Open **`/3d-preview.html`** on the deployed site's origin to view the committed GLB interactively in a mobile browser. Swipe to orbit, use the view controls, or tap **Save PNG** for a transparent browser render. This static WebGL2 page has no CDN or paid-service dependency. On devices without WebGL2, it reports that the main application keeps its original fallback. These previews are **not Blender renders**.

Do not confuse the separately downloadable *procedural candidate review pack* with this repository's committed GLB: the phone preview loads the actual file under `public/models/original/`. Browser touch, PNG saving, iOS downloads and production deployment need device-side verification; GitHub Actions quota failures do not certify them.

## Animated v2 candidate
The new `public/models/original/mypets-paw-charm-animated.glb` (109,060 bytes) contains two glTF animation clips: **Gentle hello** and **Floating heart**. It is original **procedural geometry**, not a Blender render. The old GLB and mesh fallback remain available; all animal WebP artwork stays unchanged, and no unapproved 3D animal is enabled.
Animation stops when motion is disabled in settings or when the OS requests reduced motion, and the canvas does not continuously render offscreen. The small model is included in the PWA shell for offline availability.
The `/3d-preview.html` tool continues to show the original compatible static asset; animated GLB inspection needs a multi-mesh-capable previewer. Full production visual/mobile QA remains pending; GitHub Actions quota errors are not passing checks.
