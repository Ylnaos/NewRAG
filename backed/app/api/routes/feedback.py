from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from app.api.schemas import FeedbackRequest

router = APIRouter(prefix="/api/feedback", tags=["feedback"])


@router.post("")
async def submit_feedback(request: Request, payload: FeedbackRequest) -> dict:
    answer_store = request.app.state.answer_store
    answer_record = answer_store.load(payload.answer_id)
    if answer_record is None:
        raise HTTPException(status_code=404, detail="answer not found")

    valid_node_ids = {
        str(item.get("chunk_id"))
        for item in answer_record.evidence
        if item.get("chunk_id")
    }
    valid_node_ids.update(
        str(node.get("id"))
        for node in answer_record.graph.get("nodes", [])
        if node.get("id")
    )
    if payload.node_id not in valid_node_ids:
        raise HTTPException(status_code=400, detail="node_id does not belong to answer")

    invalid_evidence_ids = [item for item in payload.evidence_ids if item not in valid_node_ids]
    if invalid_evidence_ids:
        raise HTTPException(status_code=400, detail="evidence_ids do not belong to answer")

    if payload.doc_id:
        valid_doc_ids = {
            str(item.get("doc_id"))
            for item in answer_record.evidence
            if item.get("doc_id")
        }
        if payload.doc_id not in valid_doc_ids:
            raise HTTPException(status_code=400, detail="doc_id does not belong to answer")

    service = request.app.state.feedback_service
    record = service.submit(
        answer_id=payload.answer_id,
        node_id=payload.node_id,
        score=payload.score,
        comment=payload.comment,
        doc_id=payload.doc_id,
        uncertain=payload.uncertain,
        conflict=payload.conflict,
        evidence_ids=payload.evidence_ids,
    )
    return {"feedback": record}