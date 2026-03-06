from __future__ import annotations

from typing import Dict, Optional

from app.answers.store import AnswerStore

from .models import Feedback
from .store import FeedbackStore


class FeedbackService:
    def __init__(self, store: FeedbackStore, answer_store: AnswerStore) -> None:
        self._store = store
        self._answer_store = answer_store

    def submit(
        self,
        answer_id: str,
        node_id: str,
        score: int,
        comment: Optional[str] = None,
        doc_id: Optional[str] = None,
        uncertain: Optional[bool] = None,
        conflict: Optional[bool] = None,
        evidence_ids: Optional[list[str]] = None,
    ) -> Dict[str, object]:
        answer = self._answer_store.load(answer_id)
        if answer is None:
            raise ValueError("answer not found")

        requested_evidence_ids = list(evidence_ids or [])
        valid_evidence_ids = {
            str(item.get("chunk_id") or item.get("id") or "")
            for item in answer.evidence
            if item.get("chunk_id") or item.get("id")
        }
        valid_graph_ids = {
            str(node.get("id") or "")
            for node in (answer.graph.get("nodes") or [])
            if isinstance(node, dict) and node.get("id")
        }
        valid_node_ids = valid_evidence_ids.union(valid_graph_ids)

        if node_id not in valid_node_ids:
            raise ValueError("node_id does not belong to answer")
        unknown_evidence_ids = [item for item in requested_evidence_ids if item not in valid_evidence_ids]
        if unknown_evidence_ids:
            raise ValueError("evidence_ids do not belong to answer")

        feedback = Feedback.create(
            answer_id=answer_id,
            node_id=node_id,
            score=score,
            comment=comment,
            doc_id=doc_id,
            uncertain=uncertain,
            conflict=conflict,
            evidence_ids=requested_evidence_ids,
        )
        self._store.save(feedback)
        return feedback.to_dict()
