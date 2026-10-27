# Original 3D vignette — MyPets

- Asset: `public/models/original/mypets-paw-charm.glb` (glTF 2.0, original ChatGPT procedural geometry, **not Blender-rendered**).
- No paid APIs, scraped models, external artist licensing or endorsements.
- Integrated only in the ambient toys layer. The original animal illustrations remain unchanged. If the model is not available offline or fails to load, the existing procedural paw stays visible.
- The context pause control and reduced-motion preference remain authoritative; low-power devices retain their WebGL fallback.
- The asset is deliberately not added to `approvedTripoModels`: it is a charm, not a substitute for a species-specific animated animal.
- Run `npm run assets:check`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test` and `npm run build` when runners are available; visually verify iPhone-sized layouts before claiming full QA. GitHub Actions capacity failures do not imply checks passed.
