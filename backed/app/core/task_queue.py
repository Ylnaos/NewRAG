from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
import inspect
from typing import Any, Callable, Dict, Optional
import uuid


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class TaskStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"


@dataclass
class TaskInfo:
    task_id: str
    status: TaskStatus = TaskStatus.PENDING
    created_at: datetime = field(default_factory=_utcnow)
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    attempts: int = 0
    max_retries: int = 0
    timeout_seconds: int = 60
    error: Optional[str] = None
    result: Optional[Any] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "task_id": self.task_id,
            "status": self.status.value,
            "created_at": self.created_at.isoformat(),
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "finished_at": self.finished_at.isoformat() if self.finished_at else None,
            "attempts": self.attempts,
            "max_retries": self.max_retries,
            "timeout_seconds": self.timeout_seconds,
            "error": self.error,
            "result": self.result,
        }


class TaskQueue:
    def __init__(self, max_retries: int = 2, timeout_seconds: int = 60) -> None:
        self._tasks: Dict[str, TaskInfo] = {}
        self._lock = asyncio.Lock()
        self._max_retries = max_retries
        self._timeout_seconds = timeout_seconds

    async def submit(
        self,
        func: Callable[..., Any],
        *args: Any,
        max_retries: Optional[int] = None,
        timeout_seconds: Optional[int] = None,
        **kwargs: Any,
    ) -> str:
        task_id = str(uuid.uuid4())
        info = TaskInfo(
            task_id=task_id,
            max_retries=self._max_retries if max_retries is None else max_retries,
            timeout_seconds=(
                self._timeout_seconds
                if timeout_seconds is None
                else timeout_seconds
            ),
        )
        async with self._lock:
            self._tasks[task_id] = info
        asyncio.create_task(self._run_task(task_id, func, args, kwargs))
        return task_id

    async def get(self, task_id: str) -> Optional[TaskInfo]:
        async with self._lock:
            return self._tasks.get(task_id)

    async def snapshot(self) -> Dict[str, Dict[str, Any]]:
        async with self._lock:
            return {task_id: info.to_dict() for task_id, info in self._tasks.items()}

    async def _run_task(
        self,
        task_id: str,
        func: Callable[..., Any],
        args: tuple[Any, ...],
        kwargs: Dict[str, Any],
    ) -> None:
        info = await self.get(task_id)
        if info is None:
            return
        info.status = TaskStatus.RUNNING
        info.started_at = _utcnow()

        for attempt in range(info.max_retries + 1):
            info.attempts = attempt + 1
            try:
                result = await asyncio.wait_for(
                    self._execute(func, args, kwargs),
                    timeout=info.timeout_seconds,
                )
                info.result = result
                info.status = TaskStatus.SUCCESS
                info.finished_at = _utcnow()
                return
            except asyncio.TimeoutError:
                info.error = "timeout"
            except Exception as exc:  # noqa: BLE001
                info.error = f"{type(exc).__name__}: {exc}"

            if attempt >= info.max_retries:
                info.status = TaskStatus.FAILED
                info.finished_at = _utcnow()
                return

            await asyncio.sleep(self._backoff(attempt))

    async def _execute(
        self,
        func: Callable[..., Any],
        args: tuple[Any, ...],
        kwargs: Dict[str, Any],
    ) -> Any:
        if inspect.iscoroutinefunction(func):
            return await func(*args, **kwargs)
        if inspect.iscoroutine(func):
            return await func
        return await asyncio.to_thread(func, *args, **kwargs)

    @staticmethod
    def _backoff(attempt: int) -> float:
        return min(2 ** attempt, 8)
