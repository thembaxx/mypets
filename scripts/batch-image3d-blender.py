"""Offline batch preparation of image-to-3D GLB candidates for all original pets.

This script DOES NOT call external AI generation providers. It processes GLBs
already generated from each source JPG, creates editable Blender projects,
and keeps a review manifest with explicit missing/failed/ready states.

Example:
  python3 scripts/batch-image3d-blender.py \
    --input-dir /tmp/convert3d-downloads \
    --output-dir /tmp/mypets-image3d-review \
    --blender-bin blender

Expected input names: cat.glb, dog.glb, angelfish.glb, etc.
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path


def candidate_species(root):
    return sorted(file.stem for file in (root / "assets" / "animal-originals").glob("*.jpg"))


def run_batch(root, input_dir, output_dir, blender_bin="blender", species=None):
    expected = candidate_species(root)
    if not expected:
        raise ValueError("No original animal JPGs available")
    if species is not None and species not in expected:
        raise ValueError("Unknown species: " + species)
    selected = [species] if species else expected
    output_dir.mkdir(parents=True, exist_ok=True)
    report = []
    for slug in selected:
        downloaded = input_dir / (slug + ".glb")
        if not downloaded.is_file():
            report.append({"species": slug, "status": "MISSING_GENERATED_GLB",
                           "original": "assets/animal-originals/" + slug + ".jpg"})
            continue
        destination = output_dir / slug
        destination.mkdir(parents=True, exist_ok=True)
        command = [
            blender_bin,
            "-b",
            "--factory-startup",
            "--python-exit-code", "1",
            "--python", str(root / "scripts" / "import-image3d-blender.py"),
            "--",
            "--species", slug,
            "--input-glb", str(downloaded.resolve()),
            "--output-dir", str(destination.resolve()),
        ]
        try:
            result = subprocess.run(
                command, cwd=root, capture_output=True, text=True, check=False,
                timeout=60 * 60,
            )
            if result.returncode != 0:
                report.append({"species": slug, "status": "BLENDER_REVIEW_FAILED",
                               "exit_code": result.returncode,
                               "detail": (result.stderr or result.stdout)[-2500:]})
                continue
            receipt_path = destination / (slug + "-image3d-review.json")
            receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
            report.append({
                "species": slug,
                "status": "READY_FOR_HUMAN_FIDELITY_REVIEW",
                "render_gallery": str(destination / receipt["fidelity_review_gallery"]),
                "blender_file": str(destination / (slug + "-image3d-review.blend")),
                "skinned": receipt["exported_geometry"]["skins"] > 0,
                "has_animation_clips": bool(receipt["exported_geometry"]["animations"]),
                "likeness_approved": False,
            })
        except (OSError, subprocess.TimeoutExpired, ValueError) as exc:
            report.append({"species": slug, "status": "BLENDER_REVIEW_FAILED",
                           "detail": str(exc)})
    manifest = {
        "status": "UNAPPROVED_ASSETS_ONLY",
        "expected_illustration_count": len(expected),
        "processed_count": len(selected),
        "ready_count": sum(item["status"] == "READY_FOR_HUMAN_FIDELITY_REVIEW"
                           for item in report),
        "items": report,
    }
    (output_dir / "image3d-review-manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--blender-bin", default="blender")
    parser.add_argument("--species")
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    result = run_batch(root, args.input_dir.resolve(), args.output_dir.resolve(),
                       args.blender_bin, args.species)
    print(json.dumps(result, indent=2))
    # Missing generated models are reported, not disguised as completed assets.
    if result["ready_count"] != result["processed_count"]:
        sys.exit(2)


if __name__ == "__main__":
    main()
