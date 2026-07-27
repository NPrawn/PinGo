#!/usr/bin/env python3

from __future__ import annotations

import argparse
import os
import sqlite3
import sys
from collections.abc import Callable, Sequence
from pathlib import Path, PurePosixPath
from uuid import uuid4

import h5py

AI_ROOT = Path(__file__).resolve().parents[1]
if str(AI_ROOT) not in sys.path:
    sys.path.insert(0, str(AI_ROOT))

from app.maps.global_descriptor_index import GlobalDescriptorIndex

MODEL_NAME = "VGG16-NetVLAD-Pitts30K"
DESCRIPTOR_DIMENSION = 4096
RESIZE_MAX = 1024

DescriptorExtractor = Callable[[Path, Sequence[str], Path], None]


def read_reference_image_names(database_path: Path) -> tuple[str, ...]:
    database_uri = f"file:{database_path.resolve().as_posix()}?mode=ro"
    connection = sqlite3.connect(database_uri, uri=True)
    try:
        names = tuple(
            row[0] for row in connection.execute("SELECT name FROM images ORDER BY image_id")
        )
    finally:
        connection.close()
    if not names:
        raise ValueError("COLMAP DB에 기준 이미지가 없습니다.")
    if len(names) != len(set(names)):
        raise ValueError("COLMAP DB에 중복된 기준 이미지 이름이 있습니다.")
    for name in names:
        path = PurePosixPath(name)
        if path.is_absolute() or ".." in path.parts:
            raise ValueError(f"안전하지 않은 기준 이미지 경로입니다: {name}")
    return names


def extract_with_hloc(
    image_root: Path,
    image_names: Sequence[str],
    output_path: Path,
) -> None:
    try:
        from hloc import extract_features
    except ImportError as exc:
        raise RuntimeError("HLOC이 설치되지 않았습니다. map-build 의존성을 설치하세요.") from exc

    configuration = {
        "output": "global-descriptors-netvlad",
        "model": {
            "name": "netvlad",
            "model_name": MODEL_NAME,
            "whiten": True,
        },
        "preprocessing": {
            "grayscale": False,
            "resize_max": RESIZE_MAX,
            "resize_force": False,
            "interpolation": "cv2_area",
        },
    }
    extract_features.main(
        configuration,
        image_root,
        feature_path=output_path,
        image_list=list(image_names),
        as_half=False,
        overwrite=True,
    )


def build_retrieval_index(
    image_root: Path,
    database_path: Path,
    output_path: Path,
    extractor: DescriptorExtractor = extract_with_hloc,
) -> GlobalDescriptorIndex:
    image_root = image_root.resolve()
    database_path = database_path.resolve()
    output_path = output_path.resolve()
    if output_path.exists():
        raise FileExistsError(f"출력 파일이 이미 존재합니다: {output_path}")

    image_names = read_reference_image_names(database_path)
    missing = [name for name in image_names if not (image_root / name).is_file()]
    if missing:
        raise FileNotFoundError(f"기준 이미지 파일이 없습니다: {', '.join(missing[:3])}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = output_path.with_name(f".{output_path.name}.{uuid4().hex}.tmp")
    try:
        extractor(image_root, image_names, temporary_path)
        with h5py.File(temporary_path, "a") as file:
            file.attrs["format_version"] = 1
            file.attrs["model_name"] = MODEL_NAME
            file.attrs["descriptor_dimension"] = DESCRIPTOR_DIMENSION
            file.attrs["resize_max"] = RESIZE_MAX

        index = GlobalDescriptorIndex.load(
            temporary_path,
            expected_names=set(image_names),
            expected_dimension=DESCRIPTOR_DIMENSION,
        )
        os.replace(temporary_path, output_path)
        return index
    finally:
        temporary_path.unlink(missing_ok=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--images", type=Path, default=AI_ROOT / "pipeline_output" / "images")
    parser.add_argument(
        "--database",
        type=Path,
        default=(AI_ROOT / "pipeline_output" / "colmap_aliked_lightglue_v4_2fps" / "database.db"),
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=AI_ROOT / "pipeline_output" / "global_descriptors.h5",
    )
    args = parser.parse_args()

    index = build_retrieval_index(args.images, args.database, args.output)
    print(
        f"{args.output.resolve()} images={len(index.names)} dimension={index.descriptors.shape[1]}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
