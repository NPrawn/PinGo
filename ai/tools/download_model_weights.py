#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
from pathlib import Path

import torch

from app.engine.feature_extractor import AlikedFeatureExtractor
from app.engine.global_feature_extractor import NetVladFeatureExtractor


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        while chunk := file.read(8 * 1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="오프라인 EC2 기동에 필요한 ALIKED, NetVLAD, LightGlue 가중치를 준비합니다."
    )
    parser.add_argument("--device", choices=("cpu", "cuda"), default="cpu")
    args = parser.parse_args()

    device = torch.device(args.device)
    if device.type == "cuda" and not torch.cuda.is_available():
        parser.error("CUDA를 사용할 수 없습니다.")

    AlikedFeatureExtractor(device=device).load()
    NetVladFeatureExtractor(device=device).load()

    from lightglue import LightGlue

    LightGlue(features="aliked").eval().to(device)

    hub = Path(torch.hub.get_dir())
    files = sorted(path for path in hub.rglob("*") if path.is_file())
    if not files:
        raise RuntimeError(f"모델 cache 파일이 생성되지 않았습니다: {hub}")
    for path in files:
        print(
            f"{sha256(path)}  {path.relative_to(hub).as_posix()}  "
            f"{path.stat().st_size} bytes"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
