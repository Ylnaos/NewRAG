import asyncio

import pytest

from app.core.task_queue import TaskQueue, TaskStatus


@pytest.mark.asyncio
async def test_task_queue_retries_after_exception(monkeypatch) -> None:
    # Speed up tests by removing retry backoff delay.
    monkeypatch.setattr(TaskQueue, "_backoff", staticmethod(lambda attempt: 0.0))

    queue = TaskQueue(max_retries=2, timeout_seconds=1)
    call_count = 0

    def flaky() -> str:
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise ValueError("boom")
        return "ok"

    task_id = await queue.submit(flaky)

    info = None
    for _ in range(100):
        info = await queue.get(task_id)
        assert info is not None
        if info.status in {TaskStatus.SUCCESS, TaskStatus.FAILED}:
            break
        await asyncio.sleep(0.01)

    assert info is not None
    assert info.status == TaskStatus.SUCCESS
    assert info.attempts == 2
    assert info.result == "ok"


@pytest.mark.asyncio
async def test_task_queue_times_out_and_records_error(monkeypatch) -> None:
    # Speed up tests by removing retry backoff delay.
    monkeypatch.setattr(TaskQueue, "_backoff", staticmethod(lambda attempt: 0.0))

    queue = TaskQueue(max_retries=1, timeout_seconds=0.01)

    async def slow() -> str:
        await asyncio.sleep(0.05)
        return "done"

    task_id = await queue.submit(slow)

    info = None
    for _ in range(200):
        info = await queue.get(task_id)
        assert info is not None
        if info.status in {TaskStatus.SUCCESS, TaskStatus.FAILED}:
            break
        await asyncio.sleep(0.01)

    assert info is not None
    assert info.status == TaskStatus.FAILED
    assert info.attempts == 2  # 1 initial + 1 retry
    assert info.error == "timeout"

