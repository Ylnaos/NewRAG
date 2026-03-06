from __future__ import annotations

from typing import Dict, Optional

from .models import Feedback
from .store import FeedbackStore


class FeedbackService:
    def __init__(self, store: FeedbackStore) -> None:
        self._store = store

    def submit(
        self,
        node_id: str,
        score: int,
        comment: Optional[str] = None,
        doc_id: Optional[str] = None,
        uncertain: Optional[bool] = None,
        conflict: Optional[bool] = None,
        evidence_ids: Optional[list[str]] = None,
    ) -> Dict[str, object]:
        feedback = Feedback.create(
            node_id=node_id,
            score=score,
            comment=comment,
            doc_id=doc_id,
            uncertain=uncertain,
            conflict=conflict,
            evidence_ids=evidence_ids,
        )
        self._store.save(feedback)
        return feedback.to_dict()
