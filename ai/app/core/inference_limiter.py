from __future__ import annotations

import asyncio
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class InferenceLimiterSnapshot:
    running: int
    waiting: int
    max_concurrent: int
    max_queue_size: int


class InferenceLimiter:
    """Bound synchronous inference work with a small async wait queue."""

    def __init__(self, max_concurrent: int = 1, max_queue_size: int = 2) -> None:
        if max_concurrent < 1:
            raise ValueError("max_concurrent must be at least 1")
        if max_queue_size < 0:
            raise ValueError("max_queue_size must not be negative")
        self._max_concurrent = max_concurrent
        self._max_queue_size = max_queue_size
        self._running = 0
        self._waiting = 0
        self._condition = asyncio.Condition()

    async def acquire(self) -> bool:
        async with self._condition:
            if self._running >= self._max_concurrent:
                if self._waiting >= self._max_queue_size:
                    return False
                self._waiting += 1
                try:
                    while self._running >= self._max_concurrent:
                        await self._condition.wait()
                finally:
                    self._waiting -= 1
            self._running += 1
            return True

    async def release(self) -> None:
        async with self._condition:
            if self._running <= 0:
                raise RuntimeError("inference limiter release without acquire")
            self._running -= 1
            self._condition.notify(1)

    async def snapshot(self) -> InferenceLimiterSnapshot:
        async with self._condition:
            return InferenceLimiterSnapshot(
                running=self._running,
                waiting=self._waiting,
                max_concurrent=self._max_concurrent,
                max_queue_size=self._max_queue_size,
            )
