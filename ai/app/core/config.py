from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True, slots=True)
class AppSettings:
    """AI 서버 시작 시 필요한 환경 설정."""

    map_version: str | None = None
    map_model_path: Path | None = None
    internal_token: str | None = None
    max_image_bytes: int = 8 * 1024 * 1024
    max_pixels: int = 12_000_000
    default_top_k: int = 20
    max_top_k: int = 50

    @classmethod
    def from_env(cls) -> AppSettings:
        """환경변수에서 활성 mapVersion과 sparse model 경로를 읽는다."""
        map_version = os.getenv("AI_MAP_VERSION")
        model_path = os.getenv("AI_MAP_MODEL_PATH")
        internal_token = os.getenv("AI_INTERNAL_TOKEN")
        return cls(
            map_version=map_version.strip() if map_version and map_version.strip() else None,
            map_model_path=Path(model_path) if model_path and model_path.strip() else None,
            internal_token=(
                internal_token.strip()
                if internal_token and internal_token.strip()
                else None
            ),
            max_image_bytes=_read_positive_int("AI_MAX_IMAGE_BYTES", 8 * 1024 * 1024),
            max_pixels=_read_positive_int("AI_MAX_PIXELS", 12_000_000),
            default_top_k=_read_positive_int("AI_DEFAULT_TOP_K", 20),
            max_top_k=_read_positive_int("AI_MAX_TOP_K", 50),
        )


def _read_positive_int(name: str, default: int) -> int:
    raw_value = os.getenv(name)
    if raw_value is None or not raw_value.strip():
        return default
    try:
        value = int(raw_value)
    except ValueError:
        return default
    return value if value > 0 else default
