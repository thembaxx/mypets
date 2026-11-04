"""One unapproved image-conditioned Pixal3D pilot through the PUBLIC demo.

Does not use or purchase GPU capacity. Uploads only already-public source art.
The source preprocessing is run separately. No production changes or automatic
registration as an approved MyPets animal will ever be made by this script.
"""
import argparse
import hashlib
import json
import shutil
from pathlib import Path

from gradio_client import Client, handle_file

from image3d_glb import inspect_glb

SPACE = "TencentARC/Pixal3D"


def digest_file(path: Path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--original", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--seed", type=int, default=42)
    options = parser.parse_args()
    if not options.source.is_file() or not options.original.is_file():
        raise FileNotFoundError("Prepared source PNG and original JPG are required")

    target = options.output_dir
    target.mkdir(parents=True, exist_ok=True)
    report = {
        "provider": SPACE, "mode": "PUBLIC_REVIEW_DEMO_ONLY",
        "source": str(options.original.name),
        "original_sha256": hashlib.sha256(options.original.read_bytes()).hexdigest(),
        "prepared_sha256": hashlib.sha256(options.source.read_bytes()).hexdigest(),
        "seed": options.seed,
        "resolution": 1024,
        "status": "NOT_GENERATED",
        "approved": False, "rigged": False, "animation_verified": False,
        "cost": "NO_PAID_GPU_REQUESTED",
        "license": "EXPERIMENTAL_REVIEW_ONLY_LICENSE_NOT_CLEARED_FOR_PRODUCTION",
    }
    receipt = target / "pixal3d-cat-pilot.json"
    try:
        client = Client(SPACE)
        print("Connected to public Pixal3D shared demo", flush=True)
        # Never substitute a generic procedural species mesh if a remote
        # image-to-3D inference call is unavailable, rate limited or fails.
        processed = client.predict(
            handle_file(str(options.source)), api_name="/preprocess"
        )
        result = client.predict(
            processed, options.seed, 1024, api_name="/generate_3d"
        )
        if not isinstance(result, dict) or not result.get("state_path"):
            raise RuntimeError("Pixal3D did not return a generated geometry state")
        generated = client.predict(
            result["state_path"], 2_000_000, 2048,
            api_name="/extract_glb_api"
        )
        if isinstance(generated, dict):
            generated = generated.get("path") or generated.get("name")
        if not isinstance(generated, str) or not Path(generated).is_file():
            raise RuntimeError("Pixal3D did not provide a locally downloaded GLB")
        glb = target / "cat.glb"
        shutil.copy2(generated, glb)
        details = inspect_glb(glb)
        report.update({
            "status": "GENERATED_SOURCE_CONDITIONED_GL_BUT_NOT_APPROVED",
            "glb_sha256": digest_file(glb),
            "model_properties": details,
            "rigged": details.get("rigged_and_animated", False),
        })
        print("SOURCE_CONDITIONED_GLB_CANDIDATE", json.dumps(report), flush=True)
    except Exception as exc:
        detail = str(exc)
        report["status"] = (
            "BLOCKED_FREE_ZERO_GPU_QUOTA"
            if "ZeroGPU quota" in detail
            else "BLOCKED_PUBLIC_DEMO_UNAVAILABLE"
        )
        report["error_type"] = type(exc).__name__
        report["reason"] = detail[:700]
        raise
    finally:
        receipt.write_text(json.dumps(report, indent=2)+"\n", encoding="utf-8")


if __name__ == "__main__":
    main()
