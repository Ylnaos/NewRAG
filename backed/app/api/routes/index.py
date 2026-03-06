from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from app.api.schemas import IndexBuildRequest

router = APIRouter(prefix="/api/index", tags=["index"])


@router.post("/build")
async def build_index(request: Request, payload: IndexBuildRequest) -> dict:
    index_service = request.app.state.index_service
    if payload.async_process:
        task_id = await request.app.state.task_queue.submit(index_service.build_index)
        return {"task_id": task_id}
    try:
        meta = index_service.build_index()
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {"index": meta.to_dict()}


@router.get("/status")
async def index_status(request: Request) -> dict:
    meta = request.app.state.index_service.get_status()
    return {"index": meta.to_dict() if meta else None}


@router.get("/history")
async def index_history(request: Request) -> dict:
    history = request.app.state.index_service.get_history()
    return {"history": [item.to_dict() for item in history]}
