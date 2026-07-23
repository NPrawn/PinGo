from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True, slots=True)
class AppSettings:
    """AI 서버 시작 시 필요한 환경 설정."""

    map_version: str | None = None
    map_model_path: Path | None = None

    @classmethod
    def from_env(cls) -> AppSettings:
        """환경변수에서 활성 mapVersion과 sparse model 경로를 읽는다."""
        map_version = os.getenv("AI_MAP_VERSION")
        model_path = os.getenv("AI_MAP_MODEL_PATH")
        return cls(
            map_version=map_version.strip() if map_version and map_version.strip() else None,
            map_model_path=Path(model_path) if model_path and model_path.strip() else None,
        )
