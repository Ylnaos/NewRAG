from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class IndexStatus(str, Enum):
    BUILDING = "BUILDING"
    READY = "READY"
    FAILED = "FAILED"


@dataclass
class IndexMeta:
    index_id: str
    version: int
    status: IndexStatus
    build_time: datetime
    bm25_path: str
    vector_path: str
    corpus_path: str
    doc_count: int
    started_at: datetime = field(default_factory=_utcnow)
    finished_at: datetime = field(default_factory=_utcnow)
    duration_ms: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "index_id": self.index_id,
            "version": self.version,
            "status": self.status.value,
            "build_time": self.build_time.isoformat(),
            "bm25_path": self.bm25_path,
            "vector_path": self.vector_path,
            "corpus_path": self.corpus_path,
            "doc_count": self.doc_count,
            "started_at": self.started_at.isoformat(),
            "finished_at": self.finished_at.isoformat(),
            "duration_ms": self.duration_ms,
        }

    @classmethod
    def from_dict(cls, payload: Dict[str, Any]) -> "IndexMeta":
        build_time = _parse_dt(payload.get("build_time"))
        started_at = _parse_dt(payload.get("started_at")) if payload.get("started_at") else build_time
        finished_at = _parse_dt(payload.get("finished_at")) if payload.get("finished_at") else build_time
        return cls(
            index_id=payload["index_id"],
            version=int(payload["version"]),
            status=IndexStatus(payload.get("status", IndexStatus.READY.value)),
            build_time=build_time,
            bm25_path=payload.get("bm25_path", ""),
            vector_path=payload.get("vector_path", ""),
            corpus_path=payload.get("corpus_path", ""),
            doc_count=int(payload.get("doc_count", 0)),
            started_at=started_at,
            finished_at=finished_at,
            duration_ms=int(payload.get("duration_ms", 0)),
        )


def _parse_dt(value: str | None) -> datetime:
    if not value:
        return _utcnow()
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return _utcnow()
