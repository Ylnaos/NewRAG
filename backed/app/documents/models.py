from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, Optional


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class DocumentStatus(str, Enum):
    RAW = "RAW"
    QUEUED = "QUEUED"
    PARSED = "PARSED"
    CHUNKED = "CHUNKED"
    EMBEDDED = "EMBEDDED"
    INDEXED = "INDEXED"
    READY = "READY"
    ARCHIVED = "ARCHIVED"
    ERROR = "ERROR"


@dataclass
class Document:
    doc_id: str
    title: str
    source: str
    status: DocumentStatus
    meta: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=_utcnow)
    updated_at: datetime = field(default_factory=_utcnow)

    def to_dict(self) -> Dict[str, Any]:
        meta = self.meta or {}
        return {
            "doc_id": self.doc_id,
            "title": self.title,
            "source": self.source,
            "status": self.status.value,
            "meta": meta,
            "size_bytes": int(meta.get("size_bytes", 0)) if meta.get("size_bytes") is not None else 0,
            "size_label": meta.get("size_label", ""),
            "file_name": meta.get("file_name", ""),
            "pages": int(meta.get("pages", 0)) if meta.get("pages") is not None else 0,
            "version": meta.get("version", ""),
            "tags": list(meta.get("tags", [])) if meta.get("tags") else [],
            "chunks": int(meta.get("chunks", 0)) if meta.get("chunks") is not None else 0,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

    @classmethod
    def from_dict(cls, payload: Dict[str, Any]) -> "Document":
        status_value = payload.get("status", "RAW")
        try:
            status = DocumentStatus(status_value)
        except ValueError:
            status = DocumentStatus.RAW
        return cls(
            doc_id=payload["doc_id"],
            title=payload.get("title", ""),
            source=payload.get("source", ""),
            status=status,
            meta=payload.get("meta", {}),
            created_at=_parse_dt(payload.get("created_at")),
            updated_at=_parse_dt(payload.get("updated_at")),
        )


@dataclass
class Section:
    section_id: str
    doc_id: str
    level: int
    title: str
    path: str
    parent_id: Optional[str]
    order: int

    def to_dict(self) -> Dict[str, Any]:
        return {
            "section_id": self.section_id,
            "doc_id": self.doc_id,
            "level": self.level,
            "title": self.title,
            "path": self.path,
            "parent_id": self.parent_id,
            "order": self.order,
        }

    @classmethod
    def from_dict(cls, payload: Dict[str, Any]) -> "Section":
        return cls(
            section_id=payload["section_id"],
            doc_id=payload["doc_id"],
            level=int(payload.get("level", 0)),
            title=payload.get("title", ""),
            path=payload.get("path", ""),
            parent_id=payload.get("parent_id"),
            order=int(payload.get("order", 0)),
        )


@dataclass
class Paragraph:
    paragraph_id: str
    section_id: str
    text: str
    order: int

    def to_dict(self) -> Dict[str, Any]:
        return {
            "paragraph_id": self.paragraph_id,
            "section_id": self.section_id,
            "text": self.text,
            "order": self.order,
        }

    @classmethod
    def from_dict(cls, payload: Dict[str, Any]) -> "Paragraph":
        return cls(
            paragraph_id=payload["paragraph_id"],
            section_id=payload["section_id"],
            text=payload.get("text", ""),
            order=int(payload.get("order", 0)),
        )


@dataclass
class Chunk:
    chunk_id: str
    doc_id: str
    section_id: str
    path: str
    text: str
    token_len: int
    order: int

    def to_dict(self) -> Dict[str, Any]:
        return {
            "chunk_id": self.chunk_id,
            "doc_id": self.doc_id,
            "section_id": self.section_id,
            "path": self.path,
            "text": self.text,
            "token_len": self.token_len,
            "order": self.order,
        }

    @classmethod
    def from_dict(cls, payload: Dict[str, Any]) -> "Chunk":
        return cls(
            chunk_id=payload["chunk_id"],
            doc_id=payload["doc_id"],
            section_id=payload["section_id"],
            path=payload.get("path", ""),
            text=payload.get("text", ""),
            token_len=int(payload.get("token_len", 0)),
            order=int(payload.get("order", 0)),
        )


def _parse_dt(value: Optional[str]) -> datetime:
    if not value:
        return _utcnow()
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return _utcnow()