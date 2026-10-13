# Nuzzle

A mobile-first daily companion for dogs, cats, rabbits, chickens, fish, hamsters, birds, guinea pigs, snakes, hedgehogs, ferrets, salamanders, iguanas, and geckos, built with Next.js App Router, TypeScript, Tailwind CSS, Motion, Phosphor icons, and Three.js. Oxfmt and Oxlint keep the source consistent.

## Run

Requires Node.js 22 or newer. CI runs the current Node.js 26 release.

```sh
npm ci
npm run dev
```

Open `http://localhost:3000`.

```sh
npm run lint
npm run typecheck
npm test
npm run format:check
npm run build
npm start
```

`npm run build` produces `out/`, then versions the service worker and precaches the application scripts, styles, fonts, and supplied illustrations. `npm start` serves that export. It can also be hosted by any static HTTPS host. Install and offline support require HTTPS or localhost.

The optional CUDA download from the Transformers Node dependency can be skipped in environments without GPU access:

```sh
ONNXRUNTIME_NODE_INSTALL_CUDA=skip npm ci
```

All inference in this app uses browser WebAssembly, so Node GPU libraries are not needed. The export packages the matching CPU-only ONNX runtime locally, caches it on first use, and omits unused optional backend binaries. A build check enforces the host’s 25 MiB per-file limit. Recognition models still require internet on first use. The shared Sharp dependency is pinned to 0.35.5 to include current image-decoder security fixes. All direct runtime and development dependencies are pinned to their latest stable versions checked on October 11, 2026. Both the complete and production npm audits report zero vulnerabilities.

## Identity and a lived-in demo

Nuzzle is the working name: a warm, species-neutral word for closeness. Two soft ivory forms lean together on a forest-green tile, with an apricot dot. The scalable SVG and raster PWA icons are original implementation artwork; the supplied animal illustrations are unchanged. Preferences opens an interactive identity studio comparing Nuzzle, Pippa, and Kindred, including a generated concept board. These are creative directions, without verified trademark or name availability. `lib/brand.ts` holds the identity; `npm run brand:icons` regenerates app icons from the SVG.

The demo seeds thirty past days across all seventeen sample pets, with imperfect care logs, ten practices per pet, species-specific observations, completed check-ins, and an upcoming review. A monthly chart opens a date-by-date care and learning history. Add journal notes, expand observations, and revisit a practice from its record. Actual practices and notes save into that history. Daily discoveries rotate through expanded, sourced fact collections.

The migration is idempotent and adds history only to demo collections. Creating the first personal pet clears the sample history; existing personal collections receive no invented records. Sample observations are visibly marked. The browser storage key remains `mypets-v1` so rebranding retains profiles, photos, routines, and preferences.

Self-explanatory actions use square icon buttons with accessible names and tooltips. All text inputs, date/time controls, selects, and textareas use 16px text. Contextual cards and destination actions keep the descriptive content needed to understand the choice.

## Experience

- Three contextual sections: Today, Schedule, and Training.
- Onboarding with species, searchable/custom/unknown breed, camera or upload, name, age in months or years, and optional weight.
- On-device image recognition using Transformers.js and MobileNet V2. Suggestions require confirmation. The model covers a subset of dog and cat appearances limited rabbit labels, and goldfish; it cannot establish ancestry. Low-confidence or unsupported results preserve the unknown option. The initial download requires internet access; pet images are processed locally.
- Species, age, and selected breed affect the initial care schedule, nutrition information, facts, and learning collection. Individual care needs can differ. Food portions use food-label and veterinary guidance rather than an unverified calorie calculation.
- Editable care events, day/week/month calendar, daily or one-time reminders, event completion, and `.ics` export with calendar alarms for events marked for notification.
- Pet switching through a draggable carousel, with transparent WebP cutouts of every supplied animal in `public/animals/`. Original JPEG references are preserved unchanged in `assets/animal-originals/`. Illustrations use natural colors across themes without blending or brightness filters. Animating illustrations are accompanied by actual interactive Three.js toys. They are illustrated characters, not 360-degree animal models.
- Guided species-specific learning, optional practice timers, and saved progress. Educational dog exercise video from PDSA, plus linked source articles.
- Spring transitions, a compact floating dock, drag-to-dismiss sheets, keyboard focus containment, Escape and browser-back support, optional sound, and vibration where supported.
- Installable PWA, offline shell, local fonts, persisted System / Light / Dark appearance with matching launch backgrounds, safe areas, reduced motion and transparency, camera, Web Share, data export, and calendar integration.

The centered dock has three icons without visible text, with accessible names and filled active states. Spring selections, completion checks, calendar highlights, and pet carousel transitions provide feedback; reduced motion uses calmer transitions. Text and functional icons use adaptive contrast colors across base, elevated, and tinted surfaces. Theme choice applies before the first paint and updates browser chrome and the install manifest.

The launch screen pairs the Nuzzle wordmark with a background-removed adaptation of the supplied aviator animal image. Its transparent artwork uses the app’s active background in both themes. A short entrance and fade respect reduced motion; image failure cannot block entry, and the artwork is included in the offline shell.

The expanded sample collection includes all seven newly supplied animal images. Goldfish and angelfish use different illustrations and habitat guidance; the second budgie is a variety illustration. Existing demo collections gain the new samples without changing stored routines. Personal collections remain intact. New species have sourced nutrition, facts, habitat checks, and guided care or enrichment rather than dog obedience lessons. Suggested times are editable, and life-stage categories are approximate; care must follow the exact species and veterinary guidance.

The next collection adds the supplied snake, hedgehog, ferret, canary, salamander, iguana, and gecko, and replaces the existing goldfish artwork. All 17 built-in pet illustrations have real alpha transparency, including those originally supplied with baked-in checkerboards. Cutouts are centered with safe transparent margins, and the offline shell includes every variant. Uploaded personal photographs retain their original backgrounds. Canary guidance differs from the parrot plan. Reptile and amphibian calendars use feeding-log reviews rather than assumed daily meals, with different diets for green iguanas, leopard geckos, and crested geckos. Unknown species choices retain specialist identification guidance. Existing seeded demos gain a month of history only for newly added pets; existing records and personal collections remain intact.

## Data and device capabilities

Pet profiles, compressed uploaded photos, routines, completed care, and training progress are saved in this browser's local storage. The app shows a storage warning if a write fails. Data does not sync between devices. Clearing browser data removes saved records; preferences include a JSON backup export.

Browser reminder notifications work while the app is running and permission is granted. Closed-app reminders are provided through exported device-calendar events; there is no push server or scheduled notification backend. Vibration is a progressive enhancement and is unavailable in some browsers, including iOS Safari. Optional sounds start from user interaction.

Recognition models and embedded video need an internet connection on first use. The core app remains usable offline after its service worker finishes installing. The app is entirely static and requires no API key or hosted database.

## Offline companion

The header’s conversation icon opens a contextual drawer for the selected pet. Today, care history, training lessons, and preferences also lead into the companion. It supports sourced care questions, age and breed guidance, short training explanations, recorded-month summaries, and natural-language reminder drafts. Conversations are stored separately for each pet in IndexedDB, capped at 40 messages per pet, with export and clear controls. Pet photos are never included in a model prompt.

Saved care notes work without a model or internet connection. An optional **Llama 3.2 1B** model provides more flexible explanations through **WebLLM 0.2.86**, in a dedicated browser worker. The pinned `q4f32_1` model does not require `shader-f16`; its files total approximately **710 MB**, with approximately **1.2 GB working memory**. GPU capability and available storage are checked before download. Initialization, progress, cancellation, completed-file resume, memory release, storage estimates, persistent-storage status, and removal are available in the model panel. Nothing downloads until the user chooses to download the model.

The model runs locally. The initial download connects to the model host, but conversation text and pet data are not sent to it. Model weights remain on the Hugging Face host and are cached on demand; the compatible 6 MB WASM library is included in the repository and cached separately on demand. The core PWA shell includes the worker/client scripts, care content, and license documents, without forcing a large model download.

Readiness is checked against the actual cached manifest, every weight shard, tokenizer, chat configuration, local WASM library, and exported application scripts. Configuration, tokenizer, manifest, and WASM hashes are pinned. Clearing the model deletes only the dedicated model caches; it retains pet records, photos, conversations, app-shell assets, and image-recognition caches. Browser storage can still be reclaimed by the device, which is detected on later inspection. Unsupported devices, incomplete downloads, storage failures, and generation errors retain the care-notes experience.

Model explanations use the selected pet’s current profile, retrieved care facts or lesson steps, and its own recent conversation. Generated JSON must cite known source IDs; unknown citations, links, unsafe guidance, and unsupported numerical claims fall back to the saved notes. Medical concerns, food portions, and routine quantities use deterministic guidance. Month summaries calculate totals from retained records, isolate the selected pet, exclude future records, and visibly label demo data. Any model-written history explanation keeps the exact recorded totals available separately. This is educational support, not diagnosis or a medication calculator. Source excerpts remain available offline; their original websites require connectivity.

Reminder text is parsed into an editable draft, including the requested pet, local time, duration, and daily, weekly, or one-time recurrence. Missing details are shown as assumptions. Saving requires a separate review action. Weekly days are supported in day/week/month calendars, browser alerts, storage restoration, and `RRULE:FREQ=WEEKLY;BYDAY=…` device-calendar export. Existing routines are not changed automatically. Closed-app alerts still use the exported device calendar rather than a push service.

The model is text-only and does not replace the separate on-device breed-image recognizer. Llama license, attribution, and acceptable-use documents are in `third-party/`; the model panel displays **Built with Llama** and links the bundled license.

Generation runs in a worker, can be stopped, and falls back to care notes after two minutes without a completed reply. GPU memory is released on stop, failure, timeout, or prolonged idle. Known software renderers are excluded from model downloads because the real-model test showed unacceptable inference performance. A functioning WebGPU API does not guarantee acceptable model performance on every device; test generated replies on supported hardware before release. In the development container, real model downloads, cache recovery, initialization, and offline loading were verified with Chromium’s software GPU before that exclusion, but generated tokens did not complete within the response budget. The ordinary care-notes and calendar experience was verified offline in both themes.

Changing a pet's age, breed, or species regenerates its suggested routine and preserves custom reminders. Existing care-completion history remains stored. Routine edits can be made again from Schedule.

## Structure

- `components/pet-app.tsx`: persisted state, history, navigation, notifications, and PWA installation.
- `components/onboarding.tsx`: profile setup and recognition UI.
- `components/views.tsx`: the three sections and pet carousel.
- `components/details.tsx`: contextual fact, food, learning, search, and event drawers.
- `components/ambient-scene.tsx`: real WebGL scene and fallback.
- `lib/care.ts`: care rules, sourced content, date filtering, and calendar export.
- `lib/species.ts` and `lib/extra-care.ts`: species registry, original illustrations, additional care rules, and sources.
- `lib/exotic-care.ts`: reptile, amphibian, hedgehog, and ferret care, facts, and guided observation.
- `lib/appearance.ts`: pre-paint theme and browser-chrome synchronization.
- `lib/identify.ts`: local visual recognition and confirmation suggestions.
- `public/sw.js` and `scripts/prepare-pwa.mjs`: versioned offline app shell.

Care sources are linked within the app and include PDSA, RSPCA, MSD Veterinary Manual, and the American Kennel Club. Interface inspiration comes from the supplied reference screens, Apple's materials and sheets guidance, and the MDN corner-shape reference.

## Brand and discovery

See [BRAND.md](BRAND.md) for Nuzzle’s positioning and canonical-origin configuration. Search and social metadata, structured data, the public `/about/` page and AI documentation use the same brand source. `/llms.txt` and `/llm.txt` return the same public index; `/llms-full.txt` supplies fuller context. Private device records never enter discovery content.
