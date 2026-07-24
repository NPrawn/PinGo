from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Mapping

from app.maps.global_descriptor_index import GlobalDescriptorIndex


@dataclass(frozen=True, slots=True)
class MapContext:
    """요청 처리 중 공유하는 특정 버전의 읽기 전용 COLMAP 맵 정보."""

    map_version: str
    model_path: Path
    reconstruction: Any = field(repr=False, compare=False)
    image_name_to_id: Mapping[str, int]
    camera_count: int
    registered_image_count: int
    point3d_count: int
    artifact_path: Path | None = None
    reference_features_path: Path | None = None
    global_descriptor_index: GlobalDescriptorIndex | None = field(
        default=None,
        repr=False,
        compare=False,
    )
    manifest: Mapping[str, Any] | None = field(
        default=None,
        repr=False,
        compare=False,
    )

    def find_image_id(self, image_name: str) -> int | None:
        """COLMAP에 등록된 이미지 이름으로 image ID를 조회한다."""
        return self.image_name_to_id.get(image_name)
