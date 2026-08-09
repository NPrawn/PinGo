from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True, slots=True)
class MapSpec:
    """서버 시작 시 로드할 불변 serving map 한 개의 설정."""

    map_version: str
    path: Path


@dataclass(frozen=True, slots=True)
class AppSettings:
    """AI 서버 시작 시 필요한 환경 설정."""

    map_version: str | None = None
    map_model_path: Path | None = None
    internal_token: str | None = None
    map_set_version: str | None = None
    map_root: Path | None = None
    map_versions: tuple[str, ...] = ()
    device: str = "cpu"
    max_image_bytes: int = 8 * 1024 * 1024
    max_pixels: int = 12_000_000
    default_top_k: int = 20
    max_top_k: int = 50
    max_concurrent_inferences: int = 1
    max_queue_size: int = 2
    input_size: int = 768

    @classmethod
    def from_env(cls) -> AppSettings:
        """환경변수에서 활성 mapVersion과 sparse model 경로를 읽는다."""
        map_version = os.getenv("AI_MAP_VERSION")
        model_path = os.getenv("AI_MAP_MODEL_PATH")
        map_set_version = os.getenv("AI_MAP_SET_VERSION")
        map_root = os.getenv("AI_MAP_ROOT")
        map_versions = _read_csv("AI_MAP_VERSIONS")
        internal_token = os.getenv("AI_INTERNAL_TOKEN")
        device = _read_device("AI_DEVICE", "cpu")
        return cls(
            map_version=map_version.strip() if map_version and map_version.strip() else None,
            map_model_path=Path(model_path) if model_path and model_path.strip() else None,
            internal_token=(
                internal_token.strip()
                if internal_token and internal_token.strip()
                else None
            ),
            map_set_version=(
                map_set_version.strip()
                if map_set_version and map_set_version.strip()
                else None
            ),
            map_root=Path(map_root) if map_root and map_root.strip() else None,
            map_versions=map_versions,
            device=device,
            max_image_bytes=_read_positive_int("AI_MAX_IMAGE_BYTES", 8 * 1024 * 1024),
            max_pixels=_read_positive_int("AI_MAX_PIXELS", 12_000_000),
            default_top_k=_read_positive_int("AI_DEFAULT_TOP_K", 20),
            max_top_k=_read_positive_int("AI_MAX_TOP_K", 50),
            max_concurrent_inferences=_read_positive_int(
                "AI_MAX_CONCURRENT_INFERENCES",
                1,
            ),
            max_queue_size=_read_non_negative_int("AI_MAX_QUEUE_SIZE", 2),
            input_size=_read_positive_int("AI_INPUT_SIZE", 768),
        )

    def configured_maps(self) -> tuple[MapSpec, ...]:
        """다중 맵 설정을 우선하고 기존 단일 맵 환경변수도 계속 지원한다."""
        if self.map_versions and self.map_root is not None:
            return tuple(
                MapSpec(version, self.map_root / version)
                for version in self.map_versions
            )
        if self.map_version is not None and self.map_model_path is not None:
            return (MapSpec(self.map_version, self.map_model_path),)
        return ()

    def effective_map_set_version(self) -> str | None:
        """다중 맵 요청 경로에서 사용할 논리적 맵 세트 버전."""
        if self.map_set_version is not None:
            return self.map_set_version
        configured = self.configured_maps()
        return configured[0].map_version if len(configured) == 1 else None


def _read_positive_int(name: str, default: int) -> int:
    raw_value = os.getenv(name)
    if raw_value is None or not raw_value.strip():
        return default
    try:
        value = int(raw_value)
    except ValueError:
        return default
    return value if value > 0 else default


def _read_non_negative_int(name: str, default: int) -> int:
    raw_value = os.getenv(name)
    if raw_value is None or not raw_value.strip():
        return default
    try:
        value = int(raw_value)
    except ValueError:
        return default
    return value if value >= 0 else default


def _read_device(name: str, default: str) -> str:
    raw_value = os.getenv(name)
    if raw_value is None or not raw_value.strip():
        return default
    value = raw_value.strip().lower()
    return value if value in {"cpu", "cuda", "auto"} else default


def _read_csv(name: str) -> tuple[str, ...]:
    raw_value = os.getenv(name)
    if raw_value is None:
        return ()
    values: list[str] = []
    for item in raw_value.split(","):
        value = item.strip()
        if value and value not in values:
            values.append(value)
    return tuple(values)
