#!/usr/bin/env python3

from __future__ import annotations

import argparse
import shutil
import tempfile
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True, slots=True)
class QueryPose:
    image_path: Path
    rotation_xyzw: tuple[float, float, float, float]
    translation: tuple[float, float, float]


def _parse_query(values: list[str]) -> QueryPose:
    image_path = Path(values[0]).resolve()
    if not image_path.is_file():
        raise argparse.ArgumentTypeError(f"쿼리 이미지가 없습니다: {image_path}")
    try:
        numbers = tuple(float(value) for value in values[1:])
    except ValueError as exc:
        raise argparse.ArgumentTypeError("쿼리 pose는 숫자여야 합니다.") from exc
    return QueryPose(
        image_path=image_path,
        rotation_xyzw=numbers[:4],
        translation=numbers[4:],
    )


def _max_simple_id(path: Path) -> int:
    maximum = 0
    with path.open(encoding="utf-8") as file:
        for line in file:
            stripped = line.strip()
            if stripped and not stripped.startswith("#"):
                maximum = max(maximum, int(stripped.split(maxsplit=1)[0]))
    return maximum


def _max_image_id(path: Path) -> int:
    maximum = 0
    expect_image = True
    with path.open(encoding="utf-8") as file:
        for line in file:
            if line.startswith("#"):
                continue
            if expect_image:
                if not line.strip():
                    continue
                maximum = max(maximum, int(line.split(maxsplit=1)[0]))
                expect_image = False
            else:
                expect_image = True
    return maximum


def _append_line(path: Path, line: str) -> None:
    with path.open("a", encoding="utf-8", newline="\n") as file:
        file.write(f"{line}\n")


def _append_query_images(
    model_path: Path,
    output_images: Path,
    queries: list[QueryPose],
    width: int,
    height: int,
    focal_length_px: float,
) -> list[str]:
    camera_id = _max_simple_id(model_path / "cameras.txt") + 1
    rig_id = _max_simple_id(model_path / "rigs.txt") + 1
    frame_id = _max_simple_id(model_path / "frames.txt") + 1
    image_id = _max_image_id(model_path / "images.txt") + 1

    _append_line(
        model_path / "cameras.txt",
        f"{camera_id} SIMPLE_PINHOLE {width} {height} "
        f"{focal_length_px:.17g} {width / 2:.17g} {height / 2:.17g}",
    )
    _append_line(model_path / "rigs.txt", f"{rig_id} 1 CAMERA {camera_id}")

    query_directory = output_images / "QUERY"
    query_directory.mkdir(parents=True, exist_ok=True)
    exported_names: list[str] = []
    for index, query in enumerate(queries):
        target_name = f"{index:02d}_{query.image_path.name}"
        model_name = f"QUERY/{target_name}"
        shutil.copy2(query.image_path, query_directory / target_name)

        qx, qy, qz, qw = query.rotation_xyzw
        tx, ty, tz = query.translation
        pose = f"{qw:.17g} {qx:.17g} {qy:.17g} {qz:.17g} {tx:.17g} {ty:.17g} {tz:.17g}"
        _append_line(
            model_path / "frames.txt",
            f"{frame_id} {rig_id} {pose} 1 CAMERA {camera_id} {image_id}",
        )
        with (model_path / "images.txt").open("a", encoding="utf-8", newline="\n") as file:
            file.write(f"{image_id} {pose} {camera_id} {model_name}\n\n")

        exported_names.append(model_name)
        frame_id += 1
        image_id += 1
    return exported_names


def main() -> int:
    parser = argparse.ArgumentParser(
        description="추정한 query pose를 원본과 분리된 COLMAP GUI용 모델로 내보냅니다."
    )
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--width", type=int, required=True)
    parser.add_argument("--height", type=int, required=True)
    parser.add_argument("--focal-length-px", type=float, required=True)
    parser.add_argument(
        "--query",
        nargs=8,
        action="append",
        required=True,
        metavar=("IMAGE", "QX", "QY", "QZ", "QW", "TX", "TY", "TZ"),
    )
    args = parser.parse_args()

    source_model = args.model.resolve()
    output = args.output.resolve()
    if output.exists():
        parser.error(f"출력 경로가 이미 존재합니다: {output}")
    queries = [_parse_query(values) for values in args.query]

    import pycolmap

    reconstruction = pycolmap.Reconstruction(source_model)
    with tempfile.TemporaryDirectory(prefix="pingo-query-model-") as temporary:
        text_model = Path(temporary)
        reconstruction.write_text(text_model)
        exported_names = _append_query_images(
            text_model,
            output / "images",
            queries,
            args.width,
            args.height,
            args.focal_length_px,
        )
        augmented = pycolmap.Reconstruction(text_model)
        missing = [name for name in exported_names if augmented.find_image_with_name(name) is None]
        if missing:
            raise RuntimeError(f"내보낸 query image를 다시 읽지 못했습니다: {missing}")
        sparse_output = output / "sparse"
        sparse_output.mkdir(parents=True)
        augmented.write_binary(sparse_output)

    print(f"COLMAP model: {output / 'sparse'}")
    print(f"Query images: {output / 'images'}")
    for name in exported_names:
        print(f"  {name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
