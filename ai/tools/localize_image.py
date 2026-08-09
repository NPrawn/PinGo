#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict
from pathlib import Path
from typing import Any

AI_ROOT = Path(__file__).resolve().parents[1]
if str(AI_ROOT) not in sys.path:
    sys.path.insert(0, str(AI_ROOT))

from app.engine.localizer import MultiMapLocalizer
from app.maps.map_loader import MapLoader


def discover_maps(
    requested_paths: list[Path] | None,
    requested_floor: str | None,
) -> list[tuple[str, str, Path]]:
    paths = requested_paths or sorted(
        path.parent for path in (AI_ROOT / "runtime_maps").glob("*/manifest.json")
    )
    discovered: list[tuple[str, str, Path]] = []
    for path in paths:
        resolved = path.resolve()
        manifest_path = resolved / "manifest.json"
        if not manifest_path.is_file():
            raise ValueError(f"runtime map manifest가 없습니다: {resolved}")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        version = str(manifest["mapVersion"])
        floor = manifest.get("floor")
        if not floor:
            names = manifest.get("files", [])
            floor = "B2" if version == "YS-2026-07-23.1" else None
            if floor is None and names:
                floor = version
        floor = str(floor)
        if requested_floor is None or floor.upper() == requested_floor.upper():
            discovered.append((floor, version, resolved))
    if not discovered:
        raise ValueError("조건에 맞는 runtime map이 없습니다.")
    return discovered


def prefix_candidate_names(payload: dict[str, Any], floor: str) -> None:
    for candidate in payload["candidates"]:
        name = candidate["image_name"]
        if not name.startswith(f"{floor}/"):
            candidate["image_name"] = f"{floor}/{name}"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="백엔드 없이 사진 한 장을 COLMAP serving map에 위치시킵니다."
    )
    parser.add_argument("image", type=Path)
    parser.add_argument(
        "--map",
        type=Path,
        action="append",
        help="검색할 runtime map 경로. 여러 번 지정할 수 있으며 생략하면 모두 검색합니다.",
    )
    parser.add_argument("--floor", choices=("B2", "B3"))
    parser.add_argument("--top-k", type=int, default=20)
    parser.add_argument(
        "--focal-length-px",
        type=float,
        help="Query 카메라 focal length(px). 생략하면 max(width,height)*1.2 근삿값을 사용합니다.",
    )
    args = parser.parse_args()

    image_path = args.image.resolve()
    if not image_path.is_file():
        parser.error(f"이미지 파일이 없습니다: {image_path}")
    image = image_path.read_bytes()

    from PIL import Image, ImageOps

    with Image.open(image_path) as opened:
        normalized = ImageOps.exif_transpose(opened)
        width, height = normalized.size
    focal_length = args.focal_length_px or max(width, height) * 1.2

    discovered = discover_maps(args.map, args.floor)
    contexts = {
        version: MapLoader().load(version, map_path)
        for _floor, version, map_path in discovered
    }
    result = MultiMapLocalizer(contexts).localize(
        image,
        focal_length_px=focal_length,
        top_k=args.top_k,
    )
    floor_results: list[dict[str, Any]] = []
    for item in result.map_results:
        result_payload = asdict(item.result)
        floor = item.floor or item.map_version
        prefix_candidate_names(result_payload, floor)
        result_payload["floor"] = item.floor
        result_payload["map_version"] = item.map_version
        floor_results.append(result_payload)

    best = asdict(result.result)
    if result.floor is not None:
        prefix_candidate_names(best, result.floor)
    combined_candidates = sorted(
        (candidate for floor_result in floor_results for candidate in floor_result["candidates"]),
        key=lambda candidate: candidate["similarity"],
        reverse=True,
    )[: args.top_k]
    payload = {
        **best,
        "floor": result.floor,
        "map_version": result.selected_map_version,
        "candidates": combined_candidates,
        "floor_results": floor_results,
    }
    payload["image"] = str(image_path)
    payload["image_size"] = [width, height]
    payload["focal_length_px"] = focal_length
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0 if result.selected_map_version is not None else 2


if __name__ == "__main__":
    raise SystemExit(main())
