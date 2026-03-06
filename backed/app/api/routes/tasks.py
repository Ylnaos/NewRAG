from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.get("")
async def list_tasks(request: Request) -> dict:
    queue = request.app.state.task_queue
    snapshot = await queue.snapshot()
    return {"tasks": snapshot}


@router.get("/{task_id}")
async def get_task(task_id: str, request: Request) -> dict:
    queue = request.app.state.task_queue
    info = await queue.get(task_id)
    if info is None:
        raise HTTPException(status_code=404, detail="task not found")
    return {"task": info.to_dict()}
