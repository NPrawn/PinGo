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
    """오프라인 비교를 위해 비율 유지본과 중앙 정사각본을 함께 준비한다."""
    array = _decode(image, max_size)
    return (
        _aspect_variant(array, focal_length_px, max_size),
        _square_variant(array, focal_length_px, max_size),
    )


def prepare_query_image(
    image: bytes,
    focal_length_px: float,
    max_size: int = 768,
) -> QueryImageVariant:
    """온라인 추론에 사용하는 비율 유지본 하나만 준비한다."""
    return _aspect_variant(_decode(image, max_size), focal_length_px, max_size)


def _decode(image: bytes, max_size: int) -> np.ndarray:
    if max_size <= 0:
        raise ValueError("최대 입력 크기는 1 이상이어야 합니다.")
    with Image.open(BytesIO(image)) as opened:
        normalized = ImageOps.exif_transpose(opened).convert("RGB")
        return np.asarray(normalized).copy()


def _aspect_variant(
    array: np.ndarray,
    focal_length_px: float,
    max_size: int,
) -> QueryImageVariant:
    height, width = array.shape[:2]
    aspect_scale = min(1.0, max_size / max(width, height))
    aspect_size = (
        max(1, int(round(width * aspect_scale))),
        max(1, int(round(height * aspect_scale))),
    )
    aspect = _resize(array, aspect_size)
    return QueryImageVariant(
        name="aspect",
        pixels=aspect,
        focal_length_px=float(focal_length_px) * aspect_scale,
        source_size=(width, height),
        crop_origin=(0, 0),
    )


def _square_variant(
    array: np.ndarray,
    focal_length_px: float,
    max_size: int,
) -> QueryImageVariant:
    height, width = array.shape[:2]
    side = min(width, height)
    left = (width - side) // 2
    top = (height - side) // 2
    cropped = array[top : top + side, left : left + side]
    square_scale = min(1.0, max_size / side)
    square_size = max(1, int(round(side * square_scale)))
    square = _resize(cropped, (square_size, square_size))
    return QueryImageVariant(
        name="square",
        pixels=square,
        focal_length_px=float(focal_length_px) * square_scale,
        source_size=(width, height),
        crop_origin=(left, top),
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
