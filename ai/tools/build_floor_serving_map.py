#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import os
import shutil
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

AI_ROOT = Path(__file__).resolve().parents[1]
if str(AI_ROOT) not in sys.path:
    sys.path.insert(0, str(AI_ROOT))

from app.maps.global_descriptor_index import GlobalDescriptorIndex
from build_retrieval_index import DESCRIPTOR_DIMENSION, MODEL_NAME, RESIZE_MAX
from build_serving_map import (
    HLOC_COMMIT,
    MANIFEST_SCHEMA_VERSION,
    PYCOLMAP_VERSION,
    SPARSE_FILES,
    export_reference_features,
    sha256,
)


def validate_source(
    database_path: Path,
    sparse_model: Path,
    global_descriptors: Path,
) -> tuple[tuple[str, ...], dict[str, int]]:
    import pycolmap

    reconstruction = pycolmap.Reconstruction(sparse_model)
    database_uri = f"file:{database_path.resolve().as_posix()}?mode=ro"
    connection = sqlite3.connect(database_uri, uri=True)
    try:
        rows = connection.execute(
            """
            SELECT i.image_id, i.name, k.rows, k.cols, d.rows, d.cols
            FROM images i
            JOIN keypoints k USING(image_id)
            JOIN descriptors d USING(image_id)
            ORDER BY i.image_id
            """
        ).fetchall()
    finally:
        connection.close()

    if len(rows) != reconstruction.num_reg_images():
        raise ValueError("DB 이미지 수와 sparse 등록 이미지 수가 일치하지 않습니다.")
    names: list[str] = []
    for image_id, name, keypoint_rows, keypoint_cols, descriptor_rows, descriptor_bytes in rows:
        if image_id not in reconstruction.images:
            raise ValueError(f"sparse model에 DB image ID가 없습니다: {name}")
        image = reconstruction.images[image_id]
        if image.name != name:
            raise ValueError(f"DB와 sparse image ID/name이 일치하지 않습니다: {name}")
        if (
            keypoint_rows != len(image.points2D)
            or keypoint_rows != descriptor_rows
            or keypoint_cols < 2
            or descriptor_bytes != 128 * 4
        ):
            raise ValueError(f"기준 특징과 sparse point2D가 일치하지 않습니다: {name}")
        names.append(name)

    GlobalDescriptorIndex.load(
        global_descriptors,
        expected_names=set(names),
        expected_dimension=DESCRIPTOR_DIMENSION,
    )
    return tuple(names), {
        "databaseImages": len(rows),
        "registeredImages": reconstruction.num_reg_images(),
        "points3D": reconstruction.num_points3D(),
        "cameras": reconstruction.num_cameras(),
    }


def build(
    source_map: Path,
    sparse_model: Path,
    global_descriptors: Path,
    output_root: Path,
    map_version: str,
    floor: str,
) -> Path:
    database_path = source_map / "database.db"
    names, counts = validate_source(database_path, sparse_model, global_descriptors)
    descriptor_index = GlobalDescriptorIndex.load(
        global_descriptors,
        expected_names=set(names),
        expected_dimension=DESCRIPTOR_DIMENSION,
    )

    destination = output_root / map_version
    if destination.exists():
        raise FileExistsError(f"{destination} already exists; map versions are immutable")
    output_root.mkdir(parents=True, exist_ok=True)
    temporary = output_root / f".{map_version}.{uuid4().hex}.tmp"
    temporary.mkdir()
    try:
        sfm_destination = temporary / "reference_sfm"
        sfm_destination.mkdir()
        for name in SPARSE_FILES:
            source_file = sparse_model / name
            if source_file.exists():
                shutil.copy2(source_file, sfm_destination / name)

        export_reference_features(database_path, temporary / "reference_features.db")
        shutil.copy2(global_descriptors, temporary / "global_descriptors.h5")

        artifact_files = sorted(path for path in temporary.rglob("*") if path.is_file())
        checksum_path = temporary / "checksums.sha256"
        checksum_path.write_text(
            "".join(
                f"{sha256(path)}  {path.relative_to(temporary).as_posix()}\n"
                for path in artifact_files
            ),
            encoding="utf-8",
        )
        artifact_files.append(checksum_path)
        artifact_files.sort()
        manifest = {
            "schemaVersion": MANIFEST_SCHEMA_VERSION,
            "mapVersion": map_version,
            "floor": floor,
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "sourceMap": str(source_map.resolve()),
            "versions": {
                "hlocCommit": HLOC_COMMIT,
                "pycolmap": PYCOLMAP_VERSION,
            },
            "features": {
                "extractor": "ALIKED_N16ROT",
                "modelName": "aliked-n16rot",
                "descriptorDimension": 128,
                "matcher": "ALIKED_LIGHTGLUE",
                "maxNumKeypoints": 4096,
            },
            "retrieval": {
                "name": "netvlad",
                "modelName": descriptor_index.model_name or MODEL_NAME,
                "descriptorDimension": DESCRIPTOR_DIMENSION,
                "resizeMax": descriptor_index.resize_max or RESIZE_MAX,
                "imageCount": len(descriptor_index.names),
            },
            "counts": counts,
            "coordinateFrame": "COLMAP_WORLD",
            "files": [
                {
                    "path": path.relative_to(temporary).as_posix(),
                    "bytes": path.stat().st_size,
                    "sha256": sha256(path),
                }
                for path in artifact_files
            ],
        }
        (temporary / "manifest.json").write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        os.replace(temporary, destination)
    finally:
        if temporary.exists():
            shutil.rmtree(temporary)
    return destination


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-map", type=Path, required=True)
    parser.add_argument("--sparse-model", type=Path, required=True)
    parser.add_argument("--global-descriptors", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, default=AI_ROOT / "runtime_maps")
    parser.add_argument("--map-version", required=True)
    parser.add_argument("--floor", required=True)
    args = parser.parse_args()
    destination = build(
        args.source_map.resolve(),
        args.sparse_model.resolve(),
        args.global_descriptors.resolve(),
        args.output_root.resolve(),
        args.map_version,
        args.floor,
    )
    print(destination)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
