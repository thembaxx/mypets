# Genuine replacement previews

These are **real Blender Cycles renders and Chromium WebGL screenshots** of the
GLBs on this branch. They are not mockups or generated concepts. All three animals
remain experimental; complete behaviors and physical-device QA are outstanding.

| Animal | Desktop WebGL                 | Portrait WebGL                         | Landscape WebGL                          | Blender                                              |
| ------ | ----------------------------- | -------------------------------------- | ---------------------------------------- | ---------------------------------------------------- |
| Cat    | [Desktop](desktop-cat.png)    | [Portrait](mobile-portrait-cat.png)    | [Landscape](mobile-landscape-cat.png)    | [Cycles](cat-blender.png)                            |
| Rabbit | [Desktop](desktop-rabbit.png) | [Portrait](mobile-portrait-rabbit.png) | [Landscape](mobile-landscape-rabbit.png) | [Cycles](rabbit-blender.png)                         |
| Robin  | [Desktop](desktop-bird.png)   | [Portrait](mobile-portrait-bird.png)   | [Landscape](mobile-landscape-bird.png)   | [Cycles runtime derivative](bird-rigged-blender.png) |

[Robin source mesh render](bird-source-blender.png) is kept separately from the
runtime derivative. Browser screenshots come from `tests/replacements-browser.spec.mjs`
and preserve the actual supported-animation labels and experimental status.
The full inventory and review limits are in [the review report](../replacement-preview-review.md).
