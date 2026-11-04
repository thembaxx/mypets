"""Prepare pixel-faithful transparent image-to-3D inputs, NOT 3D meshes.

The original JPGs include plain white and *baked-in gray checkerboards*.
Never replace the source art, describe a matte as a generated 3D model, or
automatically approve a GLB from this script.
Dependencies: Pillow, numpy, opencv-python-headless.
"""
import argparse
import hashlib
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

SPECIES = (
    "angelfish", "bird", "budgie", "canary", "cat", "chicken", "dog",
    "ferret", "fish", "gecko", "guinea-pig", "hamster", "hedgehog",
    "iguana", "rabbit", "salamander", "snake",
)


def prepare(src: Path, output: Path, size=1024):
    img = np.asarray(Image.open(src).convert("RGB"))
    height, width = img.shape[:2]
    if height < 128 or width < 128:
        raise ValueError("Original illustration is too small")

    corners = np.concatenate([
        img[:25, :25].reshape(-1, 3),
        img[:25, -25:].reshape(-1, 3),
        img[-25:, :25].reshape(-1, 3),
        img[-25:, -25:].reshape(-1, 3),
    ])
    background = np.median(corners.astype(np.float32), axis=0)
    if background.min() < 205 or background.max() - background.min() > 6:
        raise ValueError("Original does not have a uniform pale background")

    color = img.astype(np.int16)
    chroma = color.max(axis=2) - color.min(axis=2)
    difference = np.max(np.abs(color - background.astype(np.int16)), axis=2)
    # Gray checkerboard is JPEG-baked into several originals, not alpha.
    # Gray shadows are also *not* part of the animal.
    distance = chroma if background.min() < 240 else difference
    colored = (chroma > 9) | (difference > 110)
    seed = np.uint8((distance > 24) & colored)
    count, _, stats, _ = cv2.connectedComponentsWithStats(seed, 8)
    if count < 2:
        raise ValueError("No foreground animal could be located")
    component = max(range(1, count), key=lambda i: stats[i, cv2.CC_STAT_AREA])
    x, y, w, h, area = (int(v) for v in stats[component])
    if area < 200 or area / (width * height) > .92:
        raise ValueError("Implausible animal foreground")

    margin = max(18, int(max(w, h) * .055))
    left, top = max(0, x - margin), max(0, y - margin)
    right, bottom = min(width, x+w+margin), min(height, y+h+margin)
    neighborhood = np.zeros((height, width), dtype=np.uint8)
    neighborhood[top:bottom, left:right] = 1
    visible = np.uint8((distance > 14) & colored & (neighborhood > 0)) * 255
    kernel = max(3, int(max(w, h) * .017) | 1)
    joined = cv2.morphologyEx(
        visible, cv2.MORPH_CLOSE, np.ones((kernel, kernel), np.uint8), iterations=2
    )
    contours, _ = cv2.findContours(
        joined, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )
    matte = np.zeros((height, width), np.uint8)
    for contour in contours:
        cx, cy, cw, ch = cv2.boundingRect(contour)
        if (
            cv2.contourArea(contour) > max(25, .0002 * w * h)
            and cx >= left and cy >= top
            and cx+cw <= right and cy+ch <= bottom
        ):
            cv2.drawContours(matte, [contour], -1, 255, -1)

    matte = cv2.morphologyEx(
        matte, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8)
    )
    alpha = cv2.GaussianBlur(matte, (0, 0), 1.0)
    ys, xs = np.nonzero(alpha > 8)
    if not len(xs):
        raise ValueError("No matte foreground")
    x0, y0, x1, y1 = (int(xs.min()), int(ys.min()),
                      int(xs.max()+1), int(ys.max()+1))
    crop = Image.fromarray(
        np.dstack([img, alpha])[y0:y1, x0:x1], "RGBA"
    )
    target = round(size * .84)
    scale = target / max(crop.width, crop.height)
    new_size = (
        max(1, round(crop.width*scale)), max(1, round(crop.height*scale))
    )
    rendered = crop.resize(new_size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(
        rendered, ((size-new_size[0])//2, (size-new_size[1])//2)
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output, optimize=True)
    return {
        "species": src.stem,
        "original_sha256": hashlib.sha256(src.read_bytes()).hexdigest(),
        "original_size": [width, height],
        "subject_box_xyxy": [x0, y0, x1, y1],
        "prepared_image": output.name,
        "prepared_size": [size, size],
        "alpha_coverage": round(
            float(np.mean(np.asarray(canvas)[:, :, 3] > 128)), 4
        ),
        "source_review": "UNAPPROVED_NEEDS_VISUAL_INSPECTION",
        "generated_mesh": False,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--original-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--species", nargs="+", choices=SPECIES, default=list(SPECIES))
    parser.add_argument("--size", type=int, default=1024)
    args = parser.parse_args()
    if not 512 <= args.size <= 4096:
        parser.error("--size must be between 512 and 4096")
    manifest = []
    for slug in args.species:
        original = args.original_dir / (slug + ".jpg")
        if not original.is_file():
            raise FileNotFoundError(original)
        manifest.append(prepare(original, args.output_dir/(slug + ".png"), args.size))
    (args.output_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
