from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from .models import Feedback


class FeedbackStore:
    def __init__(self, base_dir: str) -> None:
        self._base_dir = Path(base_dir) / "feedback"
        self._base_dir.mkdir(parents=True, exist_ok=True)

    def save(self, feedback: Feedback) -> None:
        path = self._base_dir / f"{feedback.feedback_id}.json"
        path.write_text(json.dumps(feedback.to_dict(), ensure_ascii=True), encoding="utf-8")

    def list_feedback(self) -> List[Feedback]:
        items: List[Feedback] = []
        for path in self._base_dir.glob("*.json"):
            payload = json.loads(path.read_text(encoding="utf-8"))
            created_at = _parse_dt(payload.get("created_at")) or datetime.now(timezone.utc)
            items.append(
                Feedback(
                    feedback_id=payload.get("feedback_id", ""),
                    node_id=payload.get("node_id", ""),
                    score=int(payload.get("score", 0)),
                    comment=payload.get("comment", ""),
                    doc_id=payload.get("doc_id"),
                    uncertain=bool(payload.get("uncertain", False)),
                    conflict=bool(payload.get("conflict", False)),
                    evidence_ids=list(payload.get("evidence_ids", []) or []),
                    created_at=created_at,
                )
            )
        return items


def _parse_dt(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None
