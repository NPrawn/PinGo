from __future__ import annotations

from dataclasses import dataclass
from threading import Lock


@dataclass(frozen=True)
class ReadinessSnapshot:
    ready: bool
    components: dict[str, str]


class ReadinessState:
    """추론 시작 전에 필요한 구성요소의 로딩 상태를 스레드 안전하게 관리한다."""

    def __init__(self, required_components: tuple[str, ...] = ("engine", "map")) -> None:
        if not required_components:
            raise ValueError("At least one readiness component is required")
        self._components = {component: "NOT_LOADED" for component in required_components}
        self._lock = Lock()

    def mark_ready(self, component: str) -> None:
        with self._lock:
            self._require_component(component)
            self._components[component] = "READY"

    def mark_not_ready(self, component: str, reason: str = "NOT_LOADED") -> None:
        if not reason:
            raise ValueError("Readiness failure reason must not be empty")
        with self._lock:
            self._require_component(component)
            self._components[component] = reason

    def snapshot(self) -> ReadinessSnapshot:
        with self._lock:
            components = dict(self._components)
        return ReadinessSnapshot(
            ready=all(value == "READY" for value in components.values()),
            components=components,
        )

    def _require_component(self, component: str) -> None:
        if component not in self._components:
            raise KeyError(f"Unknown readiness component: {component}")
