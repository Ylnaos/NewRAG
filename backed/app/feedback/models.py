from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import uuid


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class Feedback:
    feedback_id: str
    answer_id: str
    node_id: str
    score: int
    comment: str
    doc_id: Optional[str]
    uncertain: bool
    conflict: bool
    created_at: datetime
    evidence_ids: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "feedback_id": self.feedback_id,
            "answer_id": self.answer_id,
            "node_id": self.node_id,
            "score": self.score,
            "comment": self.comment,
            "doc_id": self.doc_id,
            "uncertain": self.uncertain,
            "conflict": self.conflict,
            "evidence_ids": list(self.evidence_ids),
            "created_at": self.created_at.isoformat(),
        }

    @classmethod
    def create(
        cls,
        answer_id: str,
        node_id: str,
        score: int,
        comment: Optional[str] = None,
        doc_id: Optional[str] = None,
        uncertain: Optional[bool] = None,
        conflict: Optional[bool] = None,
        evidence_ids: Optional[List[str]] = None,
    ) -> "Feedback":
        return cls(
            feedback_id=str(uuid.uuid4()),
            answer_id=answer_id,
            node_id=node_id,
            score=score,
            comment=comment or "",
            doc_id=doc_id,
            uncertain=bool(uncertain) if uncertain is not None else False,
            conflict=bool(conflict) if conflict is not None else False,
            evidence_ids=list(evidence_ids or []),
            created_at=_utcnow(),
        )