from __future__ import annotations

from io import BytesIO
from typing import Any

import cv2
import numpy as np
import torch
from PIL import Image, ImageOps


class NetVladFeatureExtractor:
    """기준 인덱스와 같은 전처리로 Query 전역 descriptor를 추출한다."""

    def __init__(
        self,
        resize_max: int = 1024,
        device: str | torch.device | None = None,
        model_factory: Any | None = None,
    ) -> None:
        self.resize_max = resize_max
        self.device = torch.device(device or ("cuda" if torch.cuda.is_available() else "cpu"))
        self._model_factory = model_factory or self._create_model
        self._model: Any | None = None

    def load(self) -> None:
        if self._model is None:
            self._model = self._model_factory().eval().to(self.device)

    def extract(self, image: bytes, center_crop: bool = False) -> np.ndarray:
        self.load()
        array = self._decode(image)
        if center_crop:
            array = self._center_crop(array)
        array = self._resize(array)
        tensor = (
            torch.from_numpy(np.ascontiguousarray(array))
            .permute(2, 0, 1)
            .float()
            .div_(255.0)
            .unsqueeze(0)
            .to(self.device)
        )
        with torch.inference_mode():
            descriptor = self._model({"image": tensor})["global_descriptor"][0]
        result = descriptor.float().cpu().numpy()
        norm = np.linalg.norm(result)
        if result.shape != (4096,) or not np.isfinite(result).all() or norm == 0:
            raise RuntimeError("NetVLAD가 유효한 4096차원 descriptor를 반환하지 않았습니다.")
        return result / norm

    @staticmethod
    def _decode(image: bytes) -> np.ndarray:
        with Image.open(BytesIO(image)) as opened:
            normalized = ImageOps.exif_transpose(opened).convert("RGB")
            return np.asarray(normalized).copy()

    @staticmethod
    def _center_crop(image: np.ndarray) -> np.ndarray:
        height, width = image.shape[:2]
        side = min(width, height)
        left = (width - side) // 2
        top = (height - side) // 2
        return image[top : top + side, left : left + side]

    def _resize(self, image: np.ndarray) -> np.ndarray:
        height, width = image.shape[:2]
        if max(width, height) <= self.resize_max:
            return image
        scale = self.resize_max / max(width, height)
        size = (int(round(width * scale)), int(round(height * scale)))
        return cv2.resize(image, size, interpolation=cv2.INTER_AREA)

    @staticmethod
    def _create_model() -> Any:
        try:
            from hloc.extractors.netvlad import NetVLAD
        except ImportError as exc:
            raise RuntimeError("HLOC NetVLAD 의존성이 설치되지 않았습니다.") from exc
        return NetVLAD(
            {
                "model_name": "VGG16-NetVLAD-Pitts30K",
                "whiten": True,
            }
        )
