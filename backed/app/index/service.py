from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timezone
from typing import Dict, List, Optional
import time
import uuid

from app.documents.models import DocumentStatus
from app.documents.store import DocumentStore

from .bm25 import BM25Indexer
from .models import IndexMeta, IndexStatus
from .store import IndexStore
from .vector import VectorIndexer


class IndexService:
    def __init__(self, store: IndexStore, document_store: DocumentStore, vector_dim: int) -> None:
        self._store = store
        self._document_store = document_store
        self._bm25 = BM25Indexer()
        self._vector = VectorIndexer(vector_dim)

    def build_index(self) -> IndexMeta:
        started_at = datetime.now(timezone.utc)
        started_perf = time.perf_counter()
        documents = self._document_store.list_documents()
        documents.sort(key=lambda doc: doc.doc_id)
        corpus: List[Dict[str, object]] = []
        texts: List[str] = []
        doc_ids: List[str] = []

        for doc in documents:
            chunks = self._document_store.load_chunks(doc.doc_id)
            if not chunks:
                continue
            for chunk in chunks:
                corpus.append(
                    {
                        "chunk_id": chunk.chunk_id,
                        "doc_id": chunk.doc_id,
                        "section_id": chunk.section_id,
                        "path": chunk.path,
                        "text": chunk.text,
                        "order": chunk.order,
                    }
                )
                texts.append(chunk.text)
                doc_ids.append(chunk.chunk_id)

        if not corpus:
            raise ValueError("no chunks available for indexing")

        version = self._store.next_version()
        index_id = str(uuid.uuid4())
        meta = IndexMeta(
            index_id=index_id,
            version=version,
            status=IndexStatus.BUILDING,
            build_time=started_at,
            bm25_path=f"bm25_{index_id}.json",
            vector_path=f"vector_{index_id}.json",
            corpus_path=f"corpus_{index_id}.json",
            doc_count=len(corpus),
            started_at=started_at,
            finished_at=started_at,
            duration_ms=0,
        )
        self._store.save_building(meta)

        try:
            bm25_data = self._bm25.build(texts=texts, doc_ids=doc_ids)
            vector_data = self._vector.build(texts=texts, doc_ids=doc_ids)
        except Exception:  # noqa: BLE001
            finished_at = datetime.now(timezone.utc)
            duration_ms = int((time.perf_counter() - started_perf) * 1000)
            failed = replace(
                meta,
                status=IndexStatus.FAILED,
                build_time=finished_at,
                finished_at=finished_at,
                duration_ms=duration_ms,
            )
            self._store.save_building(failed)
            raise

        finished_at = datetime.now(timezone.utc)
        duration_ms = int((time.perf_counter() - started_perf) * 1000)
        meta = replace(
            meta,
            status=IndexStatus.READY,
            build_time=finished_at,
            finished_at=finished_at,
            duration_ms=duration_ms,
        )
        self._store.save_index(meta, bm25_data, vector_data, corpus)
        self._update_document_statuses()
        return meta

    def rollback(self, version: int) -> Optional[IndexMeta]:
        return self._store.set_current(version)

    def get_status(self) -> Optional[IndexMeta]:
        return self._store.load_index_meta()

    def get_history(self) -> List[IndexMeta]:
        payload = self._store.load_meta()
        history = payload.get("history", [])
        items = [IndexMeta.from_dict(item) for item in history]
        items.sort(key=lambda item: item.version, reverse=True)
        return items

    def load_current(self) -> Optional[Dict[str, object]]:
        meta = self._store.load_index_meta()
        if meta is None:
            return None
        data = self._store.load_data(meta)
        data["meta"] = meta.to_dict()
        return data

    def _update_document_statuses(self) -> None:
        docs = self._document_store.list_documents()
        now = datetime.now(timezone.utc)
        for doc in docs:
            if doc.status in {DocumentStatus.ARCHIVED, DocumentStatus.ERROR}:
                continue
            chunks = self._document_store.load_chunks(doc.doc_id)
            if not chunks:
                continue
            meta = dict(doc.meta or {})
            meta["indexed_at"] = now.isoformat()
            updated = replace(
                doc,
                status=DocumentStatus.READY,
                meta=meta,
                updated_at=now,
            )
            self._document_store.save_document(updated)
