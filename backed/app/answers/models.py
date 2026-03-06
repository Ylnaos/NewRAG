from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import uuid


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class AnswerRecord:
    answer_id: str
    query: str
    answer: str
    evidence: List[Dict[str, Any]] = field(default_factory=list)
    graph: Dict[str, Any] = field(default_factory=dict)
    thought_steps: List[str] = field(default_factory=list)
    reasoning_content: Optional[str] = None
    verify_status: str = ""
    result_mode: str = "llm"
    fallback_reason: str = ""
    created_at: datetime = field(default_factory=_utcnow)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "answer_id": self.answer_id,
            "query": self.query,
            "answer": self.answer,
            "evidence": self.evidence,
            "graph": self.graph,
            "thought_steps": list(self.thought_steps),
            "reasoning_content": self.reasoning_content,
            "verify_status": self.verify_status,
            "result_mode": self.result_mode,
            "fallback_reason": self.fallback_reason,
            "created_at": self.created_at.isoformat(),
        }

    @classmethod
    def create(
        cls,
        query: str,
        answer: str,
        evidence: List[Dict[str, Any]],
        graph: Dict[str, Any],
        thought_steps: Optional[List[str]] = None,
        reasoning_content: Optional[str] = None,
        verify_status: str = "",
        result_mode: str = "llm",
        fallback_reason: str = "",
    ) -> "AnswerRecord":
        return cls(
            answer_id=str(uuid.uuid4()),
            query=query,
            answer=answer,
            evidence=evidence,
            graph=graph,
            thought_steps=list(thought_steps or []),
            reasoning_content=reasoning_content,
            verify_status=verify_status,
            result_mode=result_mode or "llm",
            fallback_reason=fallback_reason,
        )

    @classmethod
    def from_dict(cls, payload: Dict[str, Any]) -> "AnswerRecord":
        return cls(
            answer_id=payload.get("answer_id", ""),
            query=str(payload.get("query", "")),
            answer=str(payload.get("answer", "")),
            evidence=list(payload.get("evidence", []) or []),
            graph=dict(payload.get("graph", {}) or {}),
            thought_steps=list(payload.get("thought_steps", []) or []),
            reasoning_content=payload.get("reasoning_content"),
            verify_status=str(payload.get("verify_status", "")),
            result_mode=str(payload.get("result_mode", "llm") or "llm"),
            fallback_reason=str(payload.get("fallback_reason", "")),
            created_at=_parse_dt(payload.get("created_at")),
        )


def _parse_dt(value: str | None) -> datetime:
    if not value:
        return _utcnow()
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return _utcnow()