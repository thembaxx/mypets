# Cloud Blender candidate studio — paw

This workflow can be triggered from an iPhone using GitHub's **Actions → Blender candidate art studio (manual review) → Run workflow**, once GitHub Actions capacity is available. It creates an original Blender scene and exports a GLB as an **unapproved review pack**. It installs Blender on an isolated hosted runner; there is no local computer or paid model provider requirement.

Workflow: `.github/workflows/blender-candidate.yml`. Blender source: `scripts/author-blender-candidate.py`.

The output artifact includes **.blend** (editable source), **.glb** (web format) and **.json** (Blender version, hash and provenance). This script uses original procedural primitives and authored materials, not someone else's artwork or third-party assets. It does not access API keys or external models.

The runner checks the GLB with the existing 8 MiB and 160,000-position limits. Passing these checks does **not** establish a good appearance, visual fidelity, browser animation playback, performance or license clearance for any later external inputs.

**No automatic release.** Nothing in this pipeline pushes, deploys, merges, overwrites existing assets or changes the pet/recipe UI. A reviewer must verify actual output, test iOS/desktop WebGL and approve the appearance before any candidate is adopted. Existing original artwork and fallback scenes remain authoritative.

**Current limitation:** Blender is not installed in this ChatGPT session and monthly GitHub Actions credits are exhausted. These scripts have not been executed in a real Blender runtime. The workflow will only produce actual Blender-authored files when a hosted run succeeds, and downloading the artifact from GitHub requires the usual access to this private repository.
