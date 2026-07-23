from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from typing import Any, Callable

import numpy as np
import torch
from PIL import Image, ImageOps


@dataclass(frozen=True)
class AlikedConfig:
    """기준 맵과 동일하게 유지해야 하는 ALIKED 특징 추출 설정."""

    model_name: str = "aliked-n16rot"
    max_num_keypoints: int = 4096
    detection_threshold: float = 0.2
    nms_radius: int = 2
    resize: int | None = None
    descriptor_dim: int = 128


@dataclass(frozen=True)
class LocalFeatures:
    """원본 이미지 좌표계를 사용하는 CPU 특징 배열."""

    keypoints: np.ndarray
    descriptors: np.ndarray
    scores: np.ndarray
    image_size: tuple[int, int]


class AlikedFeatureExtractor:
    """ALIKED 모델을 한 번만 로딩하고 Query 이미지의 특징을 추출한다."""

    def __init__(
        self,
        config: AlikedConfig | None = None,
        device: str | torch.device | None = None,
        model_factory: Callable[[AlikedConfig], Any] | None = None,
    ) -> None:
        self.config = config or AlikedConfig()
        self.device = torch.device(
            device or ("cuda" if torch.cuda.is_available() else "cpu")
        )
        self._model_factory = model_factory or self._create_model
        self._model: Any | None = None

    def load(self) -> None:
        """모델 가중치를 한 번만 로딩한다. 서버 시작 시 호출하여 미리 준비한다."""
        if self._model is None:
            self._model = self._model_factory(self.config).eval().to(self.device)

    def extract(self, image: bytes | Image.Image | np.ndarray | torch.Tensor) -> LocalFeatures:
        self.load()
        tensor, image_size = self._to_tensor(image)

        with torch.inference_mode():
            result = self._model.extract(tensor.to(self.device), resize=self.config.resize)

        keypoints = self._unbatch(result["keypoints"]).float().cpu().numpy()
        descriptors = self._unbatch(result["descriptors"]).float().cpu().numpy()
        scores = self._unbatch(result["keypoint_scores"]).float().cpu().numpy()
        self._validate(keypoints, descriptors, scores)

        return LocalFeatures(
            keypoints=keypoints,
            descriptors=descriptors,
            scores=scores,
            image_size=image_size,
        )

    @staticmethod
    def _unbatch(value: torch.Tensor) -> torch.Tensor:
        return value[0] if value.ndim > 0 and value.shape[0] == 1 else value

    @staticmethod
    def _to_tensor(
        image: bytes | Image.Image | np.ndarray | torch.Tensor,
    ) -> tuple[torch.Tensor, tuple[int, int]]:
        if isinstance(image, bytes):
            with Image.open(BytesIO(image)) as opened:
                pil_image = ImageOps.exif_transpose(opened).convert("RGB")
                array = np.asarray(pil_image).copy()
            tensor = torch.from_numpy(array).permute(2, 0, 1).float().div_(255.0)
        elif isinstance(image, Image.Image):
            pil_image = ImageOps.exif_transpose(image).convert("RGB")
            tensor = torch.from_numpy(np.asarray(pil_image).copy()).permute(2, 0, 1)
            tensor = tensor.float().div_(255.0)
        elif isinstance(image, np.ndarray):
            if image.ndim != 3 or image.shape[2] not in (1, 3, 4):
                raise ValueError("NumPy image must have shape HxWx1, HxWx3 or HxWx4")
            array = image[:, :, :3]
            if array.shape[2] == 1:
                array = np.repeat(array, 3, axis=2)
            tensor = torch.from_numpy(np.ascontiguousarray(array)).permute(2, 0, 1)
            tensor = tensor.float()
            if image.dtype == np.uint8:
                tensor.div_(255.0)
        elif isinstance(image, torch.Tensor):
            tensor = image.detach()
            if tensor.ndim == 4 and tensor.shape[0] == 1:
                tensor = tensor[0]
            if tensor.ndim != 3 or tensor.shape[0] not in (1, 3):
                raise ValueError("Tensor image must have shape CxHxW")
            if tensor.shape[0] == 1:
                tensor = tensor.repeat(3, 1, 1)
            tensor = tensor.float()
            if tensor.max().item() > 1.0:
                tensor = tensor.div(255.0)
        else:
            raise TypeError(f"Unsupported image type: {type(image).__name__}")

        if not torch.isfinite(tensor).all() or tensor.min() < 0 or tensor.max() > 1:
            raise ValueError("Image values must be finite and normalized to [0, 1]")
        height, width = tensor.shape[-2:]
        return tensor.contiguous(), (width, height)

    def _validate(
        self, keypoints: np.ndarray, descriptors: np.ndarray, scores: np.ndarray
    ) -> None:
        if keypoints.ndim != 2 or keypoints.shape[1] != 2:
            raise RuntimeError(f"Unexpected ALIKED keypoint shape: {keypoints.shape}")
        if descriptors.ndim != 2 or descriptors.shape[1] != self.config.descriptor_dim:
            raise RuntimeError(
                f"Expected {self.config.descriptor_dim}D ALIKED descriptors, "
                f"got {descriptors.shape}"
            )
        if len(keypoints) != len(descriptors) or len(keypoints) != len(scores):
            raise RuntimeError("ALIKED output keypoint/descriptor/score counts differ")
        if not all(np.isfinite(values).all() for values in (keypoints, descriptors, scores)):
            raise RuntimeError("ALIKED output contains non-finite values")

    @staticmethod
    def _create_model(config: AlikedConfig) -> Any:
        try:
            from lightglue import ALIKED
        except ImportError as exc:
            raise RuntimeError(
                "LightGlue is not installed. Install the locked AI dependencies first."
            ) from exc

        return ALIKED(
            model_name=config.model_name,
            max_num_keypoints=config.max_num_keypoints,
            detection_threshold=config.detection_threshold,
            nms_radius=config.nms_radius,
        )
