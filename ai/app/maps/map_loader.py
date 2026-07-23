from __future__ import annotations

from collections.abc import Callable
from pathlib import Path
from types import MappingProxyType
from typing import Any

from app.maps.map_context import MapContext

REQUIRED_MODEL_FILES = ("cameras.bin", "images.bin", "points3D.bin")


class MapLoadError(RuntimeError):
    """COLMAP 맵을 서빙 가능한 상태로 읽지 못했을 때 발생하는 오류."""


class MapLoader:
    """COLMAP sparse model을 검증하고 읽기 전용 MapContext로 변환한다."""

    def __init__(
        self,
        reconstruction_factory: Callable[[Path], Any] | None = None,
    ) -> None:
        self._reconstruction_factory = (
            reconstruction_factory or self._load_pycolmap_reconstruction
        )

    def load(self, map_version: str, model_path: str | Path) -> MapContext:
        """지정한 sparse model을 로딩하고 요청 간 공유할 맵 정보를 생성한다."""
        if not map_version or not map_version.strip():
            raise MapLoadError("mapVersion은 비어 있을 수 없습니다.")

        resolved_path = Path(model_path).resolve()
        self._validate_model_files(resolved_path)

        try:
            reconstruction = self._reconstruction_factory(resolved_path)
        except Exception as exc:
            raise MapLoadError(
                f"COLMAP sparse model 로딩에 실패했습니다: {resolved_path}"
            ) from exc

        camera_count = reconstruction.num_cameras()
        registered_image_count = reconstruction.num_reg_images()
        point3d_count = reconstruction.num_points3D()
        if camera_count == 0:
            raise MapLoadError("COLMAP 맵에 카메라가 없습니다.")
        if registered_image_count == 0:
            raise MapLoadError("COLMAP 맵에 등록된 이미지가 없습니다.")
        if point3d_count == 0:
            raise MapLoadError("COLMAP 맵에 3D point가 없습니다.")

        image_name_to_id: dict[str, int] = {}
        for image_id, image in reconstruction.images.items():
            if image.name in image_name_to_id:
                raise MapLoadError(f"중복된 COLMAP 이미지 이름입니다: {image.name}")
            if image.image_id != image_id:
                raise MapLoadError(
                    f"COLMAP image ID가 일치하지 않습니다: {image.name}"
                )
            image_name_to_id[image.name] = image_id

        if len(image_name_to_id) != registered_image_count:
            raise MapLoadError(
                "등록 이미지 수와 이미지 이름 인덱스 크기가 일치하지 않습니다."
            )

        return MapContext(
            map_version=map_version.strip(),
            model_path=resolved_path,
            reconstruction=reconstruction,
            image_name_to_id=MappingProxyType(image_name_to_id),
            camera_count=camera_count,
            registered_image_count=registered_image_count,
            point3d_count=point3d_count,
        )

    @staticmethod
    def _validate_model_files(model_path: Path) -> None:
        if not model_path.is_dir():
            raise MapLoadError(f"COLMAP sparse model 디렉터리가 없습니다: {model_path}")
        missing = [
            filename
            for filename in REQUIRED_MODEL_FILES
            if not (model_path / filename).is_file()
        ]
        if missing:
            raise MapLoadError(
                f"COLMAP sparse model 필수 파일이 없습니다: {', '.join(missing)}"
            )

    @staticmethod
    def _load_pycolmap_reconstruction(model_path: Path) -> Any:
        try:
            import pycolmap
        except ImportError as exc:
            raise MapLoadError(
                "pycolmap이 설치되지 않았습니다. AI 의존성을 먼저 설치하세요."
            ) from exc
        return pycolmap.Reconstruction(model_path)
