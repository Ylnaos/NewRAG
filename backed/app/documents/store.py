from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, Iterable, List, Optional

from .models import Chunk, Document, Paragraph, Section


class DocumentStore:
    def __init__(self, base_dir: str) -> None:
        self._base_dir = Path(base_dir)
        self._raw_dir = self._base_dir / "raw"
        self._docs_dir = self._base_dir / "docs"
        self._parsed_dir = self._base_dir / "parsed"
        self._chunks_dir = self._base_dir / "chunks"
        self._ensure_dirs()

    def _ensure_dirs(self) -> None:
        for path in [self._base_dir, self._raw_dir, self._docs_dir, self._parsed_dir, self._chunks_dir]:
            path.mkdir(parents=True, exist_ok=True)

    def save_raw(self, doc_id: str, filename: str, data: bytes) -> Path:
        suffix = Path(filename).suffix or ".bin"
        target = self._raw_dir / f"{doc_id}{suffix}"
        target.write_bytes(data)
        return target

    def get_raw_path(self, doc_id: str) -> Optional[Path]:
        matches = list(self._raw_dir.glob(f"{doc_id}.*"))
        if not matches:
            return None
        return matches[0]

    def save_document(self, document: Document) -> None:
        path = self._docs_dir / f"{document.doc_id}.json"
        path.write_text(json.dumps(document.to_dict(), ensure_ascii=True), encoding="utf-8")

    def load_document(self, doc_id: str) -> Optional[Document]:
        path = self._docs_dir / f"{doc_id}.json"
        if not path.exists():
            return None
        payload = json.loads(path.read_text(encoding="utf-8"))
        return Document.from_dict(payload)

    def list_documents(self) -> List[Document]:
        docs: List[Document] = []
        for path in self._docs_dir.glob("*.json"):
            payload = json.loads(path.read_text(encoding="utf-8"))
            docs.append(Document.from_dict(payload))
        return docs

    def save_parsed(self, doc_id: str, sections: List[Section], paragraphs: List[Paragraph]) -> None:
        payload = {
            "doc_id": doc_id,
            "sections": [section.to_dict() for section in sections],
            "paragraphs": [paragraph.to_dict() for paragraph in paragraphs],
        }
        path = self._parsed_dir / f"{doc_id}.json"
        path.write_text(json.dumps(payload, ensure_ascii=True), encoding="utf-8")

    def load_parsed(self, doc_id: str) -> Optional[Dict[str, List]]:
        path = self._parsed_dir / f"{doc_id}.json"
        if not path.exists():
            return None
        payload = json.loads(path.read_text(encoding="utf-8"))
        sections = [Section.from_dict(item) for item in payload.get("sections", [])]
        paragraphs = [Paragraph.from_dict(item) for item in payload.get("paragraphs", [])]
        return {"sections": sections, "paragraphs": paragraphs}

    def save_chunks(self, doc_id: str, chunks: List[Chunk]) -> None:
        payload = {
            "doc_id": doc_id,
            "chunks": [chunk.to_dict() for chunk in chunks],
        }
        path = self._chunks_dir / f"{doc_id}.json"
        path.write_text(json.dumps(payload, ensure_ascii=True), encoding="utf-8")

    def load_chunks(self, doc_id: str) -> Optional[List[Chunk]]:
        path = self._chunks_dir / f"{doc_id}.json"
        if not path.exists():
            return None
        payload = json.loads(path.read_text(encoding="utf-8"))
        return [Chunk.from_dict(item) for item in payload.get("chunks", [])]

    def delete_document(self, doc_id: str) -> bool:
        deleted = False
        raw_path = self.get_raw_path(doc_id)
        if raw_path and raw_path.exists():
            raw_path.unlink()
            deleted = True
        for path in [
            self._docs_dir / f"{doc_id}.json",
            self._parsed_dir / f"{doc_id}.json",
            self._chunks_dir / f"{doc_id}.json",
        ]:
            if path.exists():
                path.unlink()
                deleted = True
        return deleted
