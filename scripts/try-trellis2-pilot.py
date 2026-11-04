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
import os
import re
import shutil
from pathlib import Path

import numpy as np

from gradio_client import Client, handle_file
from PIL import Image

from image3d_glb import inspect_glb

SPACE = "microsoft/TRELLIS.2"
LATENT_KEYS = ("shape_slat_feats", "tex_slat_feats", "coords", "res")


def persist_latents(state, path: Path, original_hash: str, source_hash: str) -> str:
    """Persist true GPU-generated sparse latents to survive free GPU quota limits."""
    if not isinstance(state, dict) or any(key not in state for key in LATENT_KEYS):
        raise ValueError("Provider returned no restorable TRELLIS.2 latent state")
    payload = {key: np.asarray(state[key]) for key in LATENT_KEYS}
    for key, value in payload.items():
        if value.size == 0 or value.dtype.kind not in "fiu":
            raise ValueError("Invalid generated latent component: " + key)
        if value.dtype.kind == "f" and not np.isfinite(value).all():
            raise ValueError("Non-finite generated latent: " + key)
    payload["original_sha256"] = np.asarray(original_hash)
    payload["source_sha256"] = np.asarray(source_hash)
    np.savez_compressed(path, **payload)
    return sha256_file(path)


def restore_latents(path: Path, original_hash: str, source_hash: str) -> dict:
    """Verify original and input hashes. Never unpickle an untrusted artifact."""
    with np.load(path, allow_pickle=False) as source:
        required = (*LATENT_KEYS, "original_sha256", "source_sha256")
        if any(key not in source.files for key in required):
            raise ValueError("Incomplete TRELLIS.2 state archive")
        if str(source["original_sha256"].item()) != original_hash:
            raise ValueError("Cached state original JPG hash differs")
        if str(source["source_sha256"].item()) != source_hash:
            raise ValueError("Cached state input PNG hash differs")
        state = {key: source[key].copy() for key in LATENT_KEYS}
    for key, value in state.items():
        if value.size == 0 or value.dtype.kind not in "fiu":
            raise ValueError("Invalid cached latent: " + key)
        if value.dtype.kind == "f" and not np.isfinite(value).all():
            raise ValueError("Non-finite cached latent: " + key)
    state["res"] = int(state["res"].item())
    return state


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
    parser.add_argument(
        "--resume-state", type=Path,
        help="Real generated TRELLIS.2 latents from earlier quota-limited run",
    )
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
        # Optional read-only HF token uses a free account's 5-minute daily
        # quota. No token means the stricter anonymous 2-minute allowance.
        # Never log or persist the credential in review artifacts.
        token = os.environ.get("HF_TOKEN") or None
        report["authenticated_free_account"] = token is not None
        client = Client(SPACE, token=token, verbose=False)
        api = client.view_api(return_format="dict")
        named = api.get("named_endpoints", {})
        if "/image_to_3d" not in named or "/extract_glb" not in named:
            raise RuntimeError(
                "Official TRELLIS.2 generation/extraction endpoint unavailable: " +
                ", ".join(sorted(named.keys())[:24])
            )

        state_file = out / "trellis2-cat-latents.npz"
        if args.resume_state:
            state = restore_latents(
                args.resume_state, report["original_sha256"], report["source_sha256"]
            )
            report["status"] = "REAL_GENERATED_STATE_RESTORED_FOR_GLB_EXTRACTION"
            report["resume_from_sha256"] = sha256_file(args.resume_state)
            print("TRELLIS2_RESTORED_SOURCE_CONDITIONED_LATENTS", flush=True)
        else:
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
            report["latents_sha256"] = persist_latents(
                state, state_file, report["original_sha256"], report["source_sha256"]
            )
            report["latents_saved_for_separate_free_quota_extraction"] = True
            receipt.write_text(json.dumps(report, indent=2)+"\n")
            print("TRELLIS2_GENERATION_COMPLETED_LATENTS_SAVED", flush=True)

        print("TRELLIS2_ATTEMPTING_GLB_EXTRACTION", flush=True)
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
        quota_blocked = any(
            x in reason.lower()
            for x in ("zerogpu quota", "quota exceeded", "gpu quota", "quota")
        )
        report["status"] = (
            "BLOCKED_ZERO_GPU_QUOTA_AFTER_GENERATION_LATENTS_PRESERVED"
            if quota_blocked and (out / "trellis2-cat-latents.npz").exists()
            else "BLOCKED_ZERO_GPU_QUOTA" if quota_blocked
            else "BLOCKED_PUBLIC_DEMO_OR_INFERENCE_ERROR"
        )
        report["latent_state_available_for_resume"] = (
            (out / "trellis2-cat-latents.npz").exists() or bool(args.resume_state)
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
