from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO

import cv2
import numpy as np
from PIL import Image, ImageOps


@dataclass(frozen=True, slots=True)
class QueryImageVariant:
    name: str
    pixels: np.ndarray
    focal_length_px: float
    source_size: tuple[int, int]
    crop_origin: tuple[int, int]

    @property
    def image_size(self) -> tuple[int, int]:
        height, width = self.pixels.shape[:2]
        return width, height


def prepare_query_variants(
    image: bytes,
    focal_length_px: float,
    max_size: int = 768,
) -> tuple[QueryImageVariant, QueryImageVariant]:
    """세로 비율 유지본과 중앙 정사각본을 같은 최대 크기로 준비한다."""
    if max_size <= 0:
        raise ValueError("최대 입력 크기는 1 이상이어야 합니다.")
    with Image.open(BytesIO(image)) as opened:
        normalized = ImageOps.exif_transpose(opened).convert("RGB")
        array = np.asarray(normalized).copy()

    height, width = array.shape[:2]
    aspect_scale = min(1.0, max_size / max(width, height))
    aspect_size = (
        max(1, int(round(width * aspect_scale))),
        max(1, int(round(height * aspect_scale))),
    )
    aspect = _resize(array, aspect_size)

    side = min(width, height)
    left = (width - side) // 2
    top = (height - side) // 2
    cropped = array[top : top + side, left : left + side]
    square_scale = min(1.0, max_size / side)
    square_size = max(1, int(round(side * square_scale)))
    square = _resize(cropped, (square_size, square_size))
    return (
        QueryImageVariant(
            name="aspect",
            pixels=aspect,
            focal_length_px=float(focal_length_px) * aspect_scale,
            source_size=(width, height),
            crop_origin=(0, 0),
        ),
        QueryImageVariant(
            name="square",
            pixels=square,
            focal_length_px=float(focal_length_px) * square_scale,
            source_size=(width, height),
            crop_origin=(left, top),
        ),
    )


def _resize(image: np.ndarray, size: tuple[int, int]) -> np.ndarray:
    if (image.shape[1], image.shape[0]) == size:
        return np.ascontiguousarray(image)
    interpolation = (
        cv2.INTER_AREA
        if size[0] < image.shape[1] or size[1] < image.shape[0]
        else cv2.INTER_LINEAR
    )
    return np.ascontiguousarray(cv2.resize(image, size, interpolation=interpolation))
