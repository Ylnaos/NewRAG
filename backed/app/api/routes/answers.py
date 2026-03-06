from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

router = APIRouter(prefix="/api/answers", tags=["answers"])


@router.get("/{answer_id}")
async def get_answer(answer_id: str, request: Request) -> dict:
    store = request.app.state.answer_store
    record = store.load(answer_id)
    if record is None:
        raise HTTPException(status_code=404, detail="answer not found")
    return record.to_dict()


@router.get("/{answer_id}/graph")
async def get_answer_graph(answer_id: str, request: Request) -> dict:
    store = request.app.state.answer_store
    record = store.load(answer_id)
    if record is None:
        raise HTTPException(status_code=404, detail="answer not found")
    return {"answer_id": answer_id, "graph": record.graph}


@router.get("/{answer_id}/evidence")
async def get_answer_evidence(answer_id: str, request: Request) -> dict:
    store = request.app.state.answer_store
    record = store.load(answer_id)
    if record is None:
        raise HTTPException(status_code=404, detail="answer not found")
    return {"answer_id": answer_id, "evidence": record.evidence}
