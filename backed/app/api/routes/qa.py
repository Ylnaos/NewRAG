from __future__ import annotations

import math
from fastapi import APIRouter, HTTPException, Request

from app.answers.models import AnswerRecord
from app.api.schemas import ModelWeightsRequest, QARequest

router = APIRouter(prefix="/api/qa", tags=["qa"])


def _build_graph(evidence: list[dict], document_store) -> dict:
    nodes = []
    edges = []
    for idx, item in enumerate(evidence):
        node_id = str(item.get("chunk_id"))
        doc_id = str(item.get("doc_id") or "")
        document = document_store.load_document(doc_id) if doc_id else None
        meta = document.meta if document else {}
        file_name = meta.get("file_name") or (document.title if document else "") or doc_id or node_id
        db_name = meta.get("db_name") or meta.get("database") or "local"
        pages = int(meta.get("pages", 0) or 0)
        chunks_total = int(meta.get("chunks", 0) or 0)
        order = int(item.get("order", 0) or 0)
        page = _estimate_page(order, pages, chunks_total)
        reason = _build_reason(item)
        relevance = float(item.get("score", 0.0) or 0.0)
        node_info = str(item.get("path") or node_id)
        snippet = str(item.get("snippet") or "")
        nodes.append(
            {
                "id": node_id,
                "label": file_name or item.get("path") or node_id,
                "type": "document",
                "score": item.get("score"),
                "doc_id": doc_id,
                "section_id": item.get("section_id"),
                "path": item.get("path"),
                "metadata": {
                    "dbName": db_name,
                    "fileName": file_name,
                    "reason": reason,
                    "page": page,
                    "relevance": relevance,
                    "nodeInfo": node_info,
                    "snippet": snippet,
                },
            }
        )
        if idx > 0:
            prev = str(evidence[idx - 1].get("chunk_id"))
            edges.append({"id": f"{prev}->{node_id}", "source": prev, "target": node_id})
    return {"type": "evidence", "nodes": nodes, "edges": edges}


@router.post("/query")
async def query(request: Request, payload: QARequest) -> dict:
    qa_service = request.app.state.qa_service
    try:
        history = [_dump_model(item) for item in payload.history] if payload.history else None
        result = qa_service.answer(
            payload.query,
            top_k=payload.top_k,
            rerank_k=payload.rerank_k,
            max_evidence=payload.max_evidence,
            history=history,
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    evidence = result.get("evidence", [])
    graph = result.get("graph")
    if not isinstance(graph, dict) or not isinstance(graph.get("nodes"), list) or not isinstance(graph.get("edges"), list):
        graph = _build_graph(evidence, request.app.state.document_store)
    answer_record = AnswerRecord.create(
        query=payload.query,
        answer=str(result.get("answer") or ""),
        evidence=evidence,
        graph=graph,
        thought_steps=list(result.get("thought_steps") or []),
        reasoning_content=result.get("reasoning_content"),
    )
    request.app.state.answer_store.save(answer_record)
    return {
        "answer_id": answer_record.answer_id,
        "answer": result.get("answer"),
        "reasoning_content": result.get("reasoning_content"),
        "thought_steps": result.get("thought_steps"),
        "evidence": evidence,
        "citations": result.get("citations"),
        "verify_status": result.get("verify_status"),
        "verify_detail": result.get("verify_detail"),
        "fallback_reason": result.get("fallback_reason"),
        "coarse_sections": result.get("coarse_sections"),
        "graph": graph,
    }


@router.get("/weights")
async def get_weights(request: Request) -> dict:
    store = request.app.state.model_weights_store
    weights = store.load()
    return {"weights": weights.to_dict()}


@router.post("/weights")
async def update_weights(request: Request, payload: ModelWeightsRequest) -> dict:
    store = request.app.state.model_weights_store
    weights = store.load()
    if payload.retrieval:
        weights.retrieval.merge(_dump_model(payload.retrieval))
    if payload.evidence:
        weights.evidence.merge(_dump_model(payload.evidence))
    store.save(weights)
    request.app.state.retriever_service.update_weights(weights.retrieval)
    request.app.state.evidence_service.update_weights(weights.evidence)
    return {"weights": weights.to_dict()}


def _estimate_page(order: int, pages: int, chunks_total: int) -> int:
    if pages <= 0:
        return 1
    if order <= 0 or chunks_total <= 0:
        return 1
    chunks_per_page = max(1, int(math.ceil(chunks_total / max(pages, 1))))
    return min(pages, max(1, int(math.ceil(order / chunks_per_page))))


def _build_reason(item: dict) -> str:
    score = float(item.get("score", 0.0) or 0.0)
    confidence = float(item.get("confidence", 0.0) or 0.0)
    flags = []
    if item.get("conflict_flag"):
        flags.append("conflict")
    if item.get("redundant_flag"):
        flags.append("redundant")
    flag_text = ", ".join(flags) if flags else "clean"
    return f"score={score:.3f}, confidence={confidence:.3f}, flags={flag_text}"


def _dump_model(model) -> dict:
    if hasattr(model, "model_dump"):
        return model.model_dump(exclude_none=True)
    return model.dict(exclude_none=True)
