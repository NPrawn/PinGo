#!/usr/bin/env python3
"""Probe query ALIKED output against a known reference image in the COLMAP DB."""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

AI_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(AI_ROOT))

from app.engine.feature_extractor import AlikedConfig, AlikedFeatureExtractor


def nearest_reference(
    query_keypoints: np.ndarray, reference_keypoints: np.ndarray
) -> tuple[np.ndarray, np.ndarray]:
    indices: list[np.ndarray] = []
    distances: list[np.ndarray] = []
    for start in range(0, len(query_keypoints), 256):
        delta = (
            query_keypoints[start : start + 256, None, :]
            - reference_keypoints[None, :, :]
        )
        distance_squared = np.sum(delta * delta, axis=2)
        nearest = np.argmin(distance_squared, axis=1)
        indices.append(nearest)
        distances.append(
            np.sqrt(distance_squared[np.arange(len(nearest)), nearest])
        )
    return np.concatenate(indices), np.concatenate(distances)


def probe(pipeline_output: Path, image_name: str) -> dict:
    map_directories = sorted(pipeline_output.glob("colmap_*"))
    if len(map_directories) != 1:
        raise ValueError("Expected exactly one colmap_* directory")
    database = map_directories[0] / "database.db"

    connection = sqlite3.connect(
        f"file:{database.resolve().as_posix()}?mode=ro", uri=True
    )
    try:
        row = connection.execute(
            """
            SELECT k.rows, k.cols, k.data, d.rows, d.cols, d.data
            FROM images i
            JOIN keypoints k USING(image_id)
            JOIN descriptors d USING(image_id)
            WHERE i.name = ?
            """,
            (image_name,),
        ).fetchone()
    finally:
        connection.close()
    if row is None:
        raise ValueError(f"Reference image not found in DB: {image_name}")

    (
        keypoint_rows,
        keypoint_cols,
        keypoint_blob,
        descriptor_rows,
        descriptor_bytes,
        descriptor_blob,
    ) = row
    reference_keypoints = np.frombuffer(keypoint_blob, dtype="<f4").reshape(
        keypoint_rows, keypoint_cols
    )[:, :2]
    reference_descriptors = np.frombuffer(descriptor_blob, dtype="<f4").reshape(
        descriptor_rows, descriptor_bytes // 4
    )

    image_path = pipeline_output / "images" / image_name
    extractor = AlikedFeatureExtractor(config=AlikedConfig(resize=None))
    features = extractor.extract(image_path.read_bytes())
    nearest, distances = nearest_reference(features.keypoints, reference_keypoints)
    cosine_similarity = np.sum(
        features.descriptors * reference_descriptors[nearest], axis=1
    )
    close = distances < 1.0
    close_cosines = cosine_similarity[close]
    median_cosine = float(np.median(close_cosines)) if close.any() else 0.0
    compatible = int(close.sum()) >= 100 and median_cosine >= 0.90

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "image": image_name,
        "configuration": {
            "modelName": "aliked-n16rot",
            "resize": None,
            "maxNumKeypoints": 4096,
            "detectionThreshold": 0.2,
            "nmsRadius": 2,
        },
        "referenceKeypoints": len(reference_keypoints),
        "queryKeypoints": len(features.keypoints),
        "nearestWithin1Px": int(close.sum()),
        "medianNearestDistancePx": float(np.median(distances)),
        "meanCosineWithin1Px": float(np.mean(close_cosines)) if close.any() else 0.0,
        "medianCosineWithin1Px": median_cosine,
        "compatible": compatible,
        "criterion": "at least 100 nearest points within 1px and median cosine >= 0.90",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--pipeline-output", type=Path, default=AI_ROOT / "pipeline_output"
    )
    parser.add_argument("--image", default="B2/frame_000001.jpg")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    report = probe(args.pipeline_output.resolve(), args.image)
    rendered = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered, encoding="utf-8")
    print(rendered, end="")
    return 0 if report["compatible"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
