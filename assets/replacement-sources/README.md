# Editable replacement sources (experimental)

These are actual files, not approval receipts. None is promoted to production.

| File                  | Origin / licensing                       | Detail                                                                                                      |
| --------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| cat-imported.blend    | kenchoo; base guillaume bolis, CC BY 4.0 | Editable import of the downloaded GLB, **not** the original artist project. Embedded textures/rig/one clip. |
| rabbit-original.blend | CDmir + TinyWorlds, CC0                  | Unmodified author-provided master.                                                                          |
| rabbit-runtime.blend  | Same, CC0                                | PBR conversion with four existing actions; coarse legacy fur shell removed.                                 |
| bird-original.blend   | Grab3D / Alexander Popov, CC0            | Original full-density, source-resolution master; AI-assisted Meshy source.                                  |
| bird-rigged.blend     | Same + MyPets authoring, CC0             | Runtime density runtime derivative; weighted Head/Chest deformation; limited Idle/Touch only.               |

Full individual credit/license links, changes and commercial redistribution terms:
[`public/3d-asset-credits.txt`](../../public/3d-asset-credits.txt).
Cat's original model API license evidence and the robin's original individual
license/manifest are retained alongside the masters. Rabbit source/explicit license
can be verified at <https://opengameart.org/content/rabbit-0>.

Runtime files in `public/models/replacements/` embed all textures and buffers.
They fit the existing 25 MiB per-file export constraint. No paid host was provisioned.
Master files are outside `public/` and are not copied to the runtime or PWA shell.

Reproduce robin's limited rig using `scripts/rig-replacement-studies.py` (Blender
4.3.2). This is a deliberately limited deformation study, not a complete bird
behavior system. The preserved master permits further professional rigging.
