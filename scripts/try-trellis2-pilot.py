"""Attempt exactly one source-conditioned Microsoft TRELLIS.2 cat reconstruction.

Calls the existing PUBLIC Hugging Face ZeroGPU Space. Does not create paid
hardware, use private pet photos, or approve any generated GLB for production.
No automatic retry; free public quota failures are reported as blockers.

Prerequisites: gradio_client 2.x, Pillow, the original MyPets GLB inspector.
"""
import argparse
import base64
import hashlib
import json
import re
import shutil
from pathlib import Path

from gradio_client import Client, handle_file
from PIL import Image

from image3d_glb import inspect_glb

SPACE = "microsoft/TRELLIS.2"


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fp:
        for chunk in iter(lambda: fp.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def make_conditioned_source(source: Path, target: Path) -> None:
    """Match official demo's alpha-cropped black-background preprocessing."""
    rgba = Image.open(source).convert("RGBA")
    bbox = rgba.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError("Prepared source image has no visible subject")
    crop = rgba.crop(bbox)
    canvas = Image.new("RGBA", crop.size, (0, 0, 0, 255))
    canvas.alpha_composite(crop)
    canvas.convert("RGB").save(target, format="PNG")


def take_preview(preview, target: Path) -> bool:
    if not isinstance(preview, str):
        return False
    m = re.search(r'<img[^>]+src="data:image/jpeg;base64,([^"]+)"', preview)
    if m is None:
        return False
    target.write_bytes(base64.b64decode(m.group(1), validate=True))
    return True


def output_file(value):
    if isinstance(value, (list, tuple)) and value:
        value = value[0]
    if isinstance(value, dict):
        value = value.get("path") or value.get("name")
    if isinstance(value, str) and Path(value).is_file():
        return Path(value)
    raise ValueError("TRELLIS.2 returned no downloadable GLB")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--original", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--resolution", choices=("512", "1024", "1536"), default="1024")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    if not args.source.is_file() or not args.original.is_file():
        raise FileNotFoundError("The source PNG and original JPEG are required")
    if args.original.name != "cat.jpg":
        raise ValueError("First quality gate is cat only")

    out = args.output_dir
    out.mkdir(parents=True, exist_ok=True)
    report = {
        "provider": SPACE, "source": "cat.jpg", "generated_mesh": False,
        "approved": False, "rigged": False, "animation_verified": False,
        "cost": "PUBLIC_SHARED_GPU_NO_PAID_CAPACITY",
        "status": "NOT_STARTED", "resolution": args.resolution, "seed": args.seed,
        "source_sha256": sha256_file(args.source),
        "original_sha256": sha256_file(args.original),
    }
    receipt = out / "trellis2-cat-pilot.json"
    input_png = out / "trellis2-cat-conditioned-input.png"

    try:
        make_conditioned_source(args.source, input_png)
        report["conditioned_sha256"] = sha256_file(input_png)
        client = Client(SPACE, verbose=False)
        api = client.view_api(return_format="dict")
        named = api.get("named_endpoints", {})
        if "/image_to_3d" not in named or "/extract_glb" not in named:
            raise RuntimeError(
                "Official TRELLIS.2 generation/extraction endpoint unavailable: " +
                ", ".join(sorted(named.keys())[:24])
            )

        report["status"] = "SOURCE_SENT_TO_GENERATION"
        print("TRELLIS2_START_SOURCE_CONDITIONED_INFERENCE", flush=True)
        state, preview = client.predict(
            handle_file(str(input_png)), args.seed, args.resolution,
            7.5, 0.7, 12, 5.0,
            7.5, 0.5, 12, 3.0,
            1.0, 0.0, 12, 3.0,
            api_name="/image_to_3d",
        )
        report["status"] = "GPU_GENERATED_NOT_EXPORTED_OR_APPROVED"
        report["preview_saved"] = take_preview(preview, out/"trellis2-cat-preview.jpg")
        receipt.write_text(json.dumps(report, indent=2)+"\n")
        print("TRELLIS2_GENERATION_COMPLETED_ATTEMPTING_GLB", flush=True)

        result = client.predict(state, 500000, 4096, api_name="/extract_glb")
        downloaded = output_file(result)
        glb = out / "cat.glb"
        shutil.copy2(downloaded, glb)
        properties = inspect_glb(glb)
        report.update({
            "status": "SOURCE_CONDITIONED_GLB_FOR_VISUAL_REVIEW_ONLY",
            "generated_mesh": True,
            "glb_sha256": sha256_file(glb),
            "model_properties": properties,
            "rigged": bool(properties.get("rigged_and_animated")),
        })
        print("TRELLIS2_GENERATED_REVIEW_GLB", flush=True)
    except Exception as exc:
        reason = str(exc)
        report["status"] = (
            "BLOCKED_ZERO_GPU_QUOTA"
            if any(x in reason.lower() for x in ("zerogpu quota", "quota exceeded", "gpu quota", "quota"))
            else "BLOCKED_PUBLIC_DEMO_OR_INFERENCE_ERROR"
        )
        report["error_type"] = type(exc).__name__
        report["reason"] = reason[:800]
        print("TRELLIS2_PILOT_BLOCKED " + json.dumps({
            "status": report["status"],
            "reason": report["reason"],
        }), flush=True)
        raise
    finally:
        receipt.write_text(json.dumps(report, indent=2)+"\n", encoding="utf-8")


if __name__ == "__main__":
    main()
