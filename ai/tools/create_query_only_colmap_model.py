#!/usr/bin/env python3

from __future__ import annotations

import argparse
import tempfile
from pathlib import Path


def _data_lines(path: Path) -> list[str]:
    with path.open(encoding="utf-8") as file:
        return [line.rstrip("\r\n") for line in file if line.strip() and not line.startswith("#")]


def _write_simple_subset(
    source: Path,
    destination: Path,
    selected_ids: set[int],
) -> None:
    with source.open(encoding="utf-8") as input_file:
        with destination.open("w", encoding="utf-8", newline="\n") as output_file:
            for line in input_file:
                if line.startswith("#"):
                    output_file.write(line)
                    continue
                stripped = line.strip()
                if stripped and int(stripped.split(maxsplit=1)[0]) in selected_ids:
                    output_file.write(f"{stripped}\n")


def _select_query_images(
    source: Path,
    destination: Path,
    prefix: str,
) -> tuple[set[int], set[int], list[str]]:
    image_ids: set[int] = set()
    camera_ids: set[int] = set()
    image_names: list[str] = []
    expect_header = True
    selected = False

    with source.open(encoding="utf-8") as input_file:
        with destination.open("w", encoding="utf-8", newline="\n") as output_file:
            for line in input_file:
                if line.startswith("#"):
                    output_file.write(line)
                    continue
                if expect_header:
                    if not line.strip():
                        continue
                    fields = line.split()
                    selected = fields[-1].startswith(prefix)
                    if selected:
                        image_ids.add(int(fields[0]))
                        camera_ids.add(int(fields[-2]))
                        image_names.append(fields[-1])
                        output_file.write(line)
                    expect_header = False
                else:
                    if selected:
                        output_file.write("\n")
                    expect_header = True
    if not image_ids:
        raise ValueError(f"'{prefix}'로 시작하는 이미지가 없습니다.")
    return image_ids, camera_ids, image_names


def _select_query_frames(
    source: Path,
    destination: Path,
    query_image_ids: set[int],
) -> tuple[set[int], set[int]]:
    frame_ids: set[int] = set()
    rig_ids: set[int] = set()

    with source.open(encoding="utf-8") as input_file:
        with destination.open("w", encoding="utf-8", newline="\n") as output_file:
            for line in input_file:
                if line.startswith("#"):
                    output_file.write(line)
                    continue
                stripped = line.strip()
                if not stripped:
                    continue
                fields = stripped.split()
                data_count = int(fields[9])
                data_fields = fields[10:]
                data_ids = {int(data_fields[index + 2]) for index in range(0, data_count * 3, 3)}
                if data_ids & query_image_ids:
                    frame_ids.add(int(fields[0]))
                    rig_ids.add(int(fields[1]))
                    output_file.write(f"{stripped}\n")
    return frame_ids, rig_ids


def _copy_points_without_tracks(source: Path, destination: Path) -> None:
    with source.open(encoding="utf-8") as input_file:
        with destination.open("w", encoding="utf-8", newline="\n") as output_file:
            for line in input_file:
                if line.startswith("#"):
                    output_file.write(line)
                    continue
                fields = line.split()
                if fields:
                    output_file.write(" ".join(fields[:8]) + "\n")


def create_query_only_model(
    source_model: Path,
    output_model: Path,
    prefix: str,
) -> tuple[list[str], int]:
    import pycolmap

    if output_model.exists():
        raise FileExistsError(f"출력 경로가 이미 존재합니다: {output_model}")

    reconstruction = pycolmap.Reconstruction(source_model)
    with tempfile.TemporaryDirectory(prefix="pingo-query-only-") as temporary:
        full_text = Path(temporary) / "full"
        query_text = Path(temporary) / "query"
        full_text.mkdir()
        query_text.mkdir()
        reconstruction.write_text(full_text)

        query_image_ids, camera_ids, image_names = _select_query_images(
            full_text / "images.txt",
            query_text / "images.txt",
            prefix,
        )
        _frame_ids, rig_ids = _select_query_frames(
            full_text / "frames.txt",
            query_text / "frames.txt",
            query_image_ids,
        )
        _write_simple_subset(
            full_text / "cameras.txt",
            query_text / "cameras.txt",
            camera_ids,
        )
        _write_simple_subset(
            full_text / "rigs.txt",
            query_text / "rigs.txt",
            rig_ids,
        )
        _copy_points_without_tracks(
            full_text / "points3D.txt",
            query_text / "points3D.txt",
        )

        query_reconstruction = pycolmap.Reconstruction(query_text)
        output_model.mkdir(parents=True)
        query_reconstruction.write_binary(output_model)
        point_count = query_reconstruction.num_points3D()

    return image_names, point_count


def main() -> int:
    parser = argparse.ArgumentParser(
        description="COLMAP 모델에서 Query 카메라와 포인트 클라우드만 분리합니다."
    )
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--prefix", default="QUERY/")
    args = parser.parse_args()

    image_names, point_count = create_query_only_model(
        args.model.resolve(),
        args.output.resolve(),
        args.prefix,
    )
    print(f"COLMAP model: {args.output.resolve()}")
    print(f"Query cameras: {len(image_names)}")
    print(f"Points3D: {point_count}")
    for name in image_names:
        print(f"  {name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
