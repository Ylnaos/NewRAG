from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from app.api.schemas import FeedbackRequest

router = APIRouter(prefix="/api/feedback", tags=["feedback"])


@router.post("")
async def submit_feedback(request: Request, payload: FeedbackRequest) -> dict:
    if payload.score is None:
        raise HTTPException(status_code=400, detail="missing score")
    service = request.app.state.feedback_service
    record = service.submit(
        node_id=payload.node_id,
        score=payload.score,
        comment=payload.comment,
        doc_id=payload.doc_id,
        uncertain=payload.uncertain,
        conflict=payload.conflict,
        evidence_ids=payload.evidence_ids,
    )
    return {"feedback": record}
