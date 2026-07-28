#!/usr/bin/env python3
"""Validate that a COLMAP sparse model is compatible with its feature database."""

from __future__ import annotations

import argparse
import json
import sqlite3
import struct
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, BinaryIO


EXPECTED_FEATURE = "ALIKED_N16ROT"
EXPECTED_MATCHER = "ALIKED_LIGHTGLUE"
EXPECTED_DESCRIPTOR_DIM = 128


def _read(file: BinaryIO, fmt: str) -> tuple[Any, ...]:
    size = struct.calcsize("<" + fmt)
    data = file.read(size)
    if len(data) != size:
        raise ValueError(f"Unexpected end of COLMAP binary while reading {fmt}")
    return struct.unpack("<" + fmt, data)


def _read_c_string(file: BinaryIO) -> str:
    value = bytearray()
    while True:
        char = file.read(1)
        if char == b"\0":
            return value.decode("utf-8")
        if not char:
            raise ValueError("Unexpected end of COLMAP binary while reading image name")
        value.extend(char)


def read_images(path: Path) -> dict[int, dict[str, Any]]:
    images: dict[int, dict[str, Any]] = {}
    with path.open("rb") as file:
        (image_count,) = _read(file, "Q")
        for _ in range(image_count):
            values = _read(file, "i7di")
            image_id = int(values[0])
            name = _read_c_string(file)
            (point_count,) = _read(file, "Q")
            points = [_read(file, "ddq") for _ in range(point_count)]
            images[image_id] = {"name": name, "points": points}
    return images


def read_point_tracks(path: Path) -> tuple[int, list[tuple[int, int, int]]]:
    observations: list[tuple[int, int, int]] = []
    with path.open("rb") as file:
        (point_count,) = _read(file, "Q")
        for _ in range(point_count):
            values = _read(file, "QdddBBBd")
            point3d_id = int(values[0])
            (track_length,) = _read(file, "Q")
            for _ in range(track_length):
                image_id, point2d_idx = _read(file, "ii")
                observations.append((point3d_id, image_id, point2d_idx))
    return point_count, observations


def _load_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    with path.open(encoding="utf-8") as file:
        return json.load(file)


def inspect(pipeline_output: Path) -> dict[str, Any]:
    candidates = sorted(pipeline_output.glob("colmap_*"))
    if len(candidates) != 1:
        raise ValueError(
            f"Expected exactly one colmap_* directory in {pipeline_output}, "
            f"found {len(candidates)}"
        )

    map_root = candidates[0]
    database_path = map_root / "database.db"
    model_path = map_root / "sparse" / "0"
    images_path = pipeline_output / "images"
    required = [
        database_path,
        model_path / "cameras.bin",
        model_path / "images.bin",
        model_path / "points3D.bin",
        images_path,
    ]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise FileNotFoundError(f"Missing required artifacts: {missing}")

    feature_stage = _load_json(
        map_root / ".stages" / "features_aliked_n16rot.done.json"
    )
    matcher_stage = _load_json(
        map_root / ".stages" / "sequential_aliked_lightglue.done.json"
    )

    images = read_images(model_path / "images.bin")
    point_count, track_observations = read_point_tracks(model_path / "points3D.bin")

    uri = f"file:{database_path.resolve().as_posix()}?mode=ro"
    connection = sqlite3.connect(uri, uri=True)
    try:
        db_rows: dict[int, tuple[str, int, bytes]] = {
            image_id: (name, keypoint_rows, keypoint_data)
            for image_id, name, keypoint_rows, keypoint_data in connection.execute(
                """
                SELECT i.image_id, i.name, k.rows, k.data
                FROM images i JOIN keypoints k USING(image_id)
                """
            )
        }
        db_image_count = connection.execute("SELECT COUNT(*) FROM images").fetchone()[0]
        keypoint_count = connection.execute(
            "SELECT COUNT(*) FROM keypoints"
        ).fetchone()[0]
        descriptor_count = connection.execute(
            "SELECT COUNT(*) FROM descriptors"
        ).fetchone()[0]
        missing_features = connection.execute(
            """
            SELECT COUNT(*)
            FROM images i
            LEFT JOIN keypoints k USING(image_id)
            LEFT JOIN descriptors d USING(image_id)
            WHERE k.image_id IS NULL OR d.image_id IS NULL
            """
        ).fetchone()[0]
        feature_row_mismatches = connection.execute(
            """
            SELECT COUNT(*)
            FROM keypoints k JOIN descriptors d USING(image_id)
            WHERE k.rows != d.rows
            """
        ).fetchone()[0]
        descriptor_types = [
            {"type": descriptor_type, "images": count}
            for descriptor_type, count in connection.execute(
                "SELECT type, COUNT(*) FROM descriptors GROUP BY type"
            )
        ]
        descriptor_shapes = [
            {"storedBytesPerDescriptor": cols, "images": count}
            for cols, count in connection.execute(
                "SELECT cols, COUNT(*) FROM descriptors GROUP BY cols"
            )
        ]
        descriptor_blob_bytes = connection.execute(
            "SELECT COALESCE(SUM(LENGTH(data)), 0) FROM descriptors"
        ).fetchone()[0]
    finally:
        connection.close()

    invalid_image_references = 0
    invalid_point2d_indices = 0
    image_name_mismatches = 0
    keypoint_xy_mismatches = 0
    max_keypoint_xy_delta = 0.0
    images_with_3d_observations = 0
    linked_observations = 0

    for image_id, image in images.items():
        db_row = db_rows.get(image_id)
        if db_row is None:
            invalid_image_references += 1
            continue
        db_name, keypoint_rows, keypoint_data = db_row
        if db_name != image["name"]:
            image_name_mismatches += 1
        has_3d = False
        for point2d_idx, (x, y, point3d_id) in enumerate(image["points"]):
            if point2d_idx >= keypoint_rows:
                invalid_point2d_indices += 1
                continue
            keypoint_x, keypoint_y = struct.unpack_from(
                "<ff", keypoint_data, point2d_idx * 6 * 4
            )
            delta = max(abs(x - keypoint_x), abs(y - keypoint_y))
            max_keypoint_xy_delta = max(max_keypoint_xy_delta, delta)
            if delta > 1e-3:
                keypoint_xy_mismatches += 1
            if point3d_id != -1 and point3d_id != 2**64 - 1:
                linked_observations += 1
                has_3d = True
        images_with_3d_observations += int(has_3d)

    track_back_reference_errors = 0
    for point3d_id, image_id, point2d_idx in track_observations:
        image = images.get(image_id)
        if image is None or point2d_idx < 0 or point2d_idx >= len(image["points"]):
            track_back_reference_errors += 1
        elif image["points"][point2d_idx][2] != point3d_id:
            track_back_reference_errors += 1

    reference_image_count = sum(
        1 for path in images_path.rglob("*") if path.is_file()
    )
    checks = {
        "featureStageIsAlikedN16Rot": feature_stage.get("feature_type")
        == EXPECTED_FEATURE,
        "matcherStageIsAlikedLightGlue": matcher_stage.get("matcher_type")
        == EXPECTED_MATCHER,
        "allDatabaseImagesHaveFeatures": missing_features == 0,
        "keypointDescriptorRowsMatch": feature_row_mismatches == 0,
        "allSparseImagesExistInDatabase": invalid_image_references == 0,
        "sparseAndDatabaseNamesMatch": image_name_mismatches == 0,
        "point2dIndicesAreValid": invalid_point2d_indices == 0,
        "sparseAndDatabaseKeypointCoordinatesMatch": keypoint_xy_mismatches == 0,
        "point3dTracksAreBidirectionallyConsistent": track_back_reference_errors == 0,
        "allRegisteredImagesObserve3dPoints": images_with_3d_observations
        == len(images),
        "referenceImagesArePreserved": reference_image_count == len(images),
        "descriptorStorageMatches128Float32": descriptor_types == [
            {"type": 1, "images": db_image_count}
        ]
        and descriptor_shapes
        == [{"storedBytesPerDescriptor": EXPECTED_DESCRIPTOR_DIM * 4, "images": db_image_count}],
    }

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": {
            "pipelineOutput": pipeline_output.name,
            "mapDirectory": map_root.name,
            "database": database_path.relative_to(pipeline_output).as_posix(),
            "sparseModel": model_path.relative_to(pipeline_output).as_posix(),
        },
        "featureConfiguration": {
            "extractor": feature_stage.get("feature_type"),
            "matcher": matcher_stage.get("matcher_type"),
            "maxNumFeatures": feature_stage.get("max_num_features"),
            "descriptorDimension": EXPECTED_DESCRIPTOR_DIM,
            "descriptorStorage": "FLOAT32",
        },
        "counts": {
            "databaseImages": db_image_count,
            "registeredImages": len(images),
            "referenceImageFiles": reference_image_count,
            "keypointRows": keypoint_count,
            "descriptorRows": descriptor_count,
            "points3D": point_count,
            "point3DTrackObservations": len(track_observations),
            "linkedImageObservations": linked_observations,
            "descriptorBlobBytes": descriptor_blob_bytes,
        },
        "errors": {
            "missingFeatureRows": missing_features,
            "featureRowMismatches": feature_row_mismatches,
            "invalidSparseImageReferences": invalid_image_references,
            "imageNameMismatches": image_name_mismatches,
            "invalidPoint2dIndices": invalid_point2d_indices,
            "keypointCoordinateMismatches": keypoint_xy_mismatches,
            "point3dTrackBackReferenceErrors": track_back_reference_errors,
        },
        "metrics": {"maxKeypointCoordinateDeltaPx": max_keypoint_xy_delta},
        "checks": checks,
        "compatible": all(checks.values()),
        "conclusion": (
            "The sparse model directly references ALIKED_N16ROT keypoints and can "
            "be used without retriangulation."
            if all(checks.values())
            else "The map is not ready for direct ALIKED serving; inspect failed checks."
        ),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--pipeline-output",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "pipeline_output",
    )
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    report = inspect(args.pipeline_output.resolve())
    rendered = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered, encoding="utf-8")
    print(rendered, end="")
    return 0 if report["compatible"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
