#!/usr/bin/env python3
"""Build an immutable runtime map from the larger COLMAP pipeline output."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from inspect_colmap_map import inspect


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
    destination = output_root / map_version
    if destination.exists():
        raise FileExistsError(
            f"{destination} already exists; map versions are immutable"
        )
    destination.mkdir(parents=True)

    sfm_destination = destination / "reference_sfm"
    sfm_destination.mkdir()
    for name in SPARSE_FILES:
        source_file = source_map / "sparse" / "0" / name
        if source_file.exists():
            shutil.copy2(source_file, sfm_destination / name)

    feature_destination = destination / "reference_features.db"
    export_reference_features(source_map / "database.db", feature_destination)
    shutil.copy2(
        global_descriptors, destination / f"global_descriptors{global_descriptors.suffix}"
    )

    artifact_files = sorted(
        path for path in destination.rglob("*") if path.is_file()
    )
    manifest = {
        "mapVersion": map_version,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "sourceMap": report["source"]["mapDirectory"],
        "features": {
            "extractor": "ALIKED_N16ROT",
            "modelName": "aliked-n16rot",
            "descriptorDimension": 128,
            "matcher": "ALIKED_LIGHTGLUE",
            "maxNumKeypoints": 4096,
        },
        "counts": report["counts"],
        "coordinateFrame": "COLMAP_WORLD",
        "files": [
            {
                "path": path.relative_to(destination).as_posix(),
                "bytes": path.stat().st_size,
                "sha256": sha256(path),
            }
            for path in artifact_files
        ],
    }
    (destination / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return destination


def main() -> int:
    ai_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--pipeline-output", type=Path, default=ai_root / "pipeline_output"
    )
    parser.add_argument(
        "--output-root", type=Path, default=ai_root / "runtime_maps"
    )
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
