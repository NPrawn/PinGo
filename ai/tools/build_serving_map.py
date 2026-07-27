#!/usr/bin/env python3
"""Build an immutable runtime map from the larger COLMAP pipeline output."""

from __future__ import annotations

import argparse
import hashlib
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
from build_retrieval_index import (
    DESCRIPTOR_DIMENSION,
    MODEL_NAME,
    RESIZE_MAX,
    read_reference_image_names,
)
from inspect_colmap_map import inspect

HLOC_COMMIT = "c13273bd0ecc2917a35910fd843712a1c6243193"
MANIFEST_SCHEMA_VERSION = 1
PYCOLMAP_VERSION = "3.13.0"

SPARSE_FILES = (
    "cameras.bin",
    "images.bin",
    "points3D.bin",
    "rigs.bin",
    "frames.bin",
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        while chunk := file.read(8 * 1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def export_reference_features(source: Path, destination: Path) -> None:
    """Export only runtime feature tables, excluding build matches and geometry."""
    source_uri = f"file:{source.resolve().as_posix()}?mode=ro"
    source_connection = sqlite3.connect(source_uri, uri=True)
    destination_connection = sqlite3.connect(destination)
    try:
        destination_connection.executescript(
            """
            PRAGMA journal_mode=OFF;
            PRAGMA synchronous=OFF;
            CREATE TABLE images (
                image_id INTEGER PRIMARY KEY NOT NULL,
                name TEXT NOT NULL UNIQUE,
                camera_id INTEGER NOT NULL
            );
            CREATE TABLE keypoints (
                image_id INTEGER PRIMARY KEY NOT NULL,
                rows INTEGER NOT NULL,
                cols INTEGER NOT NULL,
                data BLOB
            );
            CREATE TABLE descriptors (
                image_id INTEGER PRIMARY KEY NOT NULL,
                type INTEGER NOT NULL,
                rows INTEGER NOT NULL,
                cols INTEGER NOT NULL,
                data BLOB
            );
            """
        )
        for table, columns in (
            ("images", "image_id, name, camera_id"),
            ("keypoints", "image_id, rows, cols, data"),
            ("descriptors", "image_id, type, rows, cols, data"),
        ):
            rows = source_connection.execute(f"SELECT {columns} FROM {table}")
            placeholders = ",".join("?" for _ in columns.split(","))
            destination_connection.executemany(
                f"INSERT INTO {table} ({columns}) VALUES ({placeholders})", rows
            )
        destination_connection.executescript(
            """
            CREATE INDEX idx_images_name ON images(name);
            PRAGMA user_version=1;
            """
        )
        destination_connection.commit()
    finally:
        source_connection.close()
        destination_connection.close()


def build(
    pipeline_output: Path,
    output_root: Path,
    map_version: str,
    global_descriptors: Path,
) -> Path:
    report = inspect(pipeline_output)
    if not report["compatible"]:
        raise RuntimeError("Source map validation failed; serving map was not created")
    if not global_descriptors.is_file():
        raise FileNotFoundError(
            "Retrieval global descriptors are required before building a serving map"
        )

    source_map = pipeline_output / report["source"]["mapDirectory"]
    reference_names = read_reference_image_names(source_map / "database.db")
    descriptor_index = GlobalDescriptorIndex.load(
        global_descriptors,
        expected_names=set(reference_names),
        expected_dimension=DESCRIPTOR_DIMENSION,
    )
    destination = output_root / map_version
    if destination.exists():
        raise FileExistsError(f"{destination} already exists; map versions are immutable")
    output_root.mkdir(parents=True, exist_ok=True)
    temporary_destination = output_root / f".{map_version}.{uuid4().hex}.tmp"
    temporary_destination.mkdir()
    try:
        sfm_destination = temporary_destination / "reference_sfm"
        sfm_destination.mkdir()
        for name in SPARSE_FILES:
            source_file = source_map / "sparse" / "0" / name
            if source_file.exists():
                shutil.copy2(source_file, sfm_destination / name)

        feature_destination = temporary_destination / "reference_features.db"
        export_reference_features(source_map / "database.db", feature_destination)
        shutil.copy2(
            global_descriptors,
            temporary_destination / "global_descriptors.h5",
        )

        artifact_files = sorted(path for path in temporary_destination.rglob("*") if path.is_file())
        checksum_path = temporary_destination / "checksums.sha256"
        checksum_path.write_text(
            "".join(
                f"{sha256(path)}  {path.relative_to(temporary_destination).as_posix()}\n"
                for path in artifact_files
            ),
            encoding="utf-8",
        )
        artifact_files.append(checksum_path)
        artifact_files.sort()

        manifest = {
            "schemaVersion": MANIFEST_SCHEMA_VERSION,
            "mapVersion": map_version,
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "sourceMap": report["source"]["mapDirectory"],
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
            "counts": report["counts"],
            "coordinateFrame": "COLMAP_WORLD",
            "files": [
                {
                    "path": path.relative_to(temporary_destination).as_posix(),
                    "bytes": path.stat().st_size,
                    "sha256": sha256(path),
                }
                for path in artifact_files
            ],
        }
        (temporary_destination / "manifest.json").write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        os.replace(temporary_destination, destination)
    finally:
        if temporary_destination.exists():
            shutil.rmtree(temporary_destination)
    return destination


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pipeline-output", type=Path, default=AI_ROOT / "pipeline_output")
    parser.add_argument("--output-root", type=Path, default=AI_ROOT / "runtime_maps")
    parser.add_argument("--map-version", required=True)
    parser.add_argument("--global-descriptors", type=Path, required=True)
    args = parser.parse_args()

    destination = build(
        args.pipeline_output.resolve(),
        args.output_root.resolve(),
        args.map_version,
        args.global_descriptors.resolve(),
    )
    print(destination)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
