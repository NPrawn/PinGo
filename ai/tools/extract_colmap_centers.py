#!/usr/bin/env python3
"""COLMAP sparse 재구성의 `images.bin` 에서 등록 이미지의 카메라 중심을 뽑는다.

`coord_overlay.py` 의 입력을 만드는 스크립트다. pycolmap 없이 동작하도록 바이너리를
직접 읽는다 — 검증용 도구가 무거운 의존성 때문에 못 돌아가면 안 된다.

카메라 중심은 `C = -R^T t` 다. images.bin 에 담긴 것은 world→camera 의 (q, t) 이므로
그대로 쓰면 카메라 위치가 아니라 원점의 카메라 좌표가 된다.

사용:
    python3 extract_colmap_centers.py \
        --base pipeline_output/colmap_aliked_lightglue_v3 \
        --floor B2=B2/sparse/0 --floor B3=B3/sparse/1 \
        --out colmap_centers.csv
"""

from __future__ import annotations

import argparse
import csv
import os
import struct
import sys
from pathlib import Path


def read_images_bin(path):
    """(image_id, name, cx, cy, cz) 목록. point2D 블록은 건너뛴다."""
    rows = []
    with open(path, "rb") as fh:
        (count,) = struct.unpack("<Q", fh.read(8))
        for _ in range(count):
            (image_id,) = struct.unpack("<I", fh.read(4))
            qw, qx, qy, qz = struct.unpack("<4d", fh.read(32))
            tx, ty, tz = struct.unpack("<3d", fh.read(24))
            fh.read(4)  # camera_id
            name = bytearray()
            while True:
                ch = fh.read(1)
                if ch in (b"\x00", b""):
                    break
                name += ch
            (n2d,) = struct.unpack("<Q", fh.read(8))
            # point2D 는 (x, y, point3D_id) = 8+8+8 바이트다. 파일 대부분이 이것이라 건너뛴다.
            fh.seek(n2d * 24, os.SEEK_CUR)

            norm = qw * qw + qx * qx + qy * qy + qz * qz
            s = 2.0 / norm
            r = (
                (1 - s * (qy * qy + qz * qz), s * (qx * qy - qz * qw), s * (qx * qz + qy * qw)),
                (s * (qx * qy + qz * qw), 1 - s * (qx * qx + qz * qz), s * (qy * qz - qx * qw)),
                (s * (qx * qz - qy * qw), s * (qy * qz + qx * qw), 1 - s * (qx * qx + qy * qy)),
            )
            # -R^T t : R 의 열이 R^T 의 행이다.
            cx = -(r[0][0] * tx + r[1][0] * ty + r[2][0] * tz)
            cy = -(r[0][1] * tx + r[1][1] * ty + r[2][1] * tz)
            cz = -(r[0][2] * tx + r[1][2] * ty + r[2][2] * tz)
            rows.append((image_id, name.decode("utf-8", "replace"), cx, cy, cz))
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="pipeline_output/colmap_aliked_lightglue_v3")
    ap.add_argument(
        "--floor",
        action="append",
        required=True,
        metavar="CODE=REL_PATH",
        help="층 코드와 sparse 디렉터리 (예: B2=B2/sparse/0). 여러 번 줄 수 있다.",
    )
    ap.add_argument("--out", default="colmap_centers.csv")
    a = ap.parse_args()

    base = Path(a.base)
    with open(a.out, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["floor", "image_id", "name", "colmap_cx", "colmap_cy", "colmap_cz"])
        for spec in a.floor:
            code, _, rel = spec.partition("=")
            path = base / rel / "images.bin"
            if not path.exists():
                print(f"[{code}] images.bin 없음: {path}", file=sys.stderr)
                continue
            rows = read_images_bin(path)
            print(f"[{code}] 등록 이미지 {len(rows)}개  <- {path}", file=sys.stderr)
            for image_id, name, cx, cy, cz in sorted(rows, key=lambda r: r[1]):
                w.writerow([code, image_id, name, f"{cx:.6f}", f"{cy:.6f}", f"{cz:.6f}"])
    print(f"-> {a.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
