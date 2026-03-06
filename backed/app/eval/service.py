from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence

from app.core.config import Settings
from app.documents.service import DocumentService
from app.documents.store import DocumentStore
from app.evidence.service import EvidenceFusionService
from app.index.service import IndexService
from app.index.store import IndexStore
from app.retriever.service import RetrieverService

from .metrics import mean, mrr, ndcg, percentile


@dataclass(frozen=True)
class EvalDocument:
    filename: str
    content: str
    title: Optional[str] = None
    source: Optional[str] = None
    meta: Optional[Dict[str, Any]] = None


@dataclass(frozen=True)
class EvalSample:
    sample_id: str
    query: str
    expected_evidence: List[str]
    top_k: int = 5
    rerank_k: int = 20
    max_evidence: int = 5


@dataclass(frozen=True)
class EvalDataset:
    documents: List[EvalDocument]
    samples: List[EvalSample]
    defaults: Dict[str, Any]


def build_dataset(payload: Dict[str, Any]) -> EvalDataset:
    defaults = payload.get("defaults", {}) or {}
    documents = [
        EvalDocument(
            filename=str(item.get("filename", "doc.txt")),
            content=str(item.get("content", "")),
            title=item.get("title"),
            source=item.get("source"),
            meta=item.get("meta"),
        )
        for item in payload.get("documents", []) or []
    ]
    samples: List[EvalSample] = []
    items = payload.get("samples", []) or []
    for idx, item in enumerate(items, start=1):
        sample_id = str(item.get("sample_id") or item.get("id") or f"sample-{idx}")
        expected = item.get("expected_evidence")
        if expected is None:
            expected = item.get("evidence", [])
        if expected is None:
            expected = []
        samples.append(
            EvalSample(
                sample_id=sample_id,
                query=str(item.get("query", "")),
                expected_evidence=[str(value) for value in expected if value],
                top_k=int(item.get("top_k", defaults.get("top_k", 5))),
                rerank_k=int(item.get("rerank_k", defaults.get("rerank_k", 20))),
                max_evidence=int(item.get("max_evidence", defaults.get("max_evidence", 5))),
            )
        )
    return EvalDataset(documents=documents, samples=samples, defaults=defaults)


def run_evaluation_dataset(
    dataset: EvalDataset,
    data_dir: str,
    settings: Optional[Settings] = None,
) -> Dict[str, Any]:
    settings = settings or Settings.from_env()
    if not dataset.samples:
        raise ValueError("dataset has no samples")

    services = _build_services(data_dir, settings)
    if dataset.documents:
        _ingest_documents(services.document_service, dataset.documents, settings.max_upload_mb)

    index_meta = services.index_service.build_index()

    sample_rows: List[Dict[str, Any]] = []
    latencies: List[float] = []
    warnings: List[str] = []

    for sample in dataset.samples:
        start = time.perf_counter()
        retrieval = services.retriever.retrieve(
            sample.query,
            top_k=sample.top_k,
            rerank_k=sample.rerank_k,
        )
        fine_chunks = retrieval.get("fine_chunks", [])
        evidence = services.evidence_fusion.fuse(
            sample.query,
            fine_chunks,
            max_evidence=sample.max_evidence,
        )
        latency_ms = (time.perf_counter() - start) * 1000.0
        latencies.append(latency_ms)

        relevance = _build_relevance(fine_chunks, sample.expected_evidence)
        expected_hits = _expected_hits(fine_chunks, sample.expected_evidence)
        evidence_hits = _expected_hits(evidence, sample.expected_evidence)

        expected_count = len(sample.expected_evidence)
        if expected_count == 0:
            warnings.append(f"sample {sample.sample_id} has no expected evidence")

        recall = len(expected_hits) / expected_count if expected_count else 0.0
        evidence_coverage = len(evidence_hits) / expected_count if expected_count else 0.0

        sample_rows.append(
            {
                "sample_id": sample.sample_id,
                "query": sample.query,
                "top_k": sample.top_k,
                "rerank_k": sample.rerank_k,
                "recall": recall,
                "mrr": mrr(relevance),
                "ndcg": ndcg(relevance),
                "evidence_coverage": evidence_coverage,
                "latency_ms": latency_ms,
                "expected_evidence_count": expected_count,
                "matched_evidence_count": len(expected_hits),
            }
        )

    summary = {
        "sample_count": len(sample_rows),
        "avg_recall": mean([row["recall"] for row in sample_rows]),
        "avg_mrr": mean([row["mrr"] for row in sample_rows]),
        "avg_ndcg": mean([row["ndcg"] for row in sample_rows]),
        "avg_evidence_coverage": mean([row["evidence_coverage"] for row in sample_rows]),
        "avg_latency_ms": mean(latencies),
        "p95_latency_ms": percentile(latencies, 0.95),
        "index": index_meta.to_dict(),
        "warnings": warnings,
    }

    return {"summary": summary, "samples": sample_rows}


@dataclass(frozen=True)
class _EvalServices:
    document_service: DocumentService
    index_service: IndexService
    retriever: RetrieverService
    evidence_fusion: EvidenceFusionService


def _build_services(data_dir: str, settings: Settings) -> _EvalServices:
    store = DocumentStore(data_dir)
    document_service = DocumentService(
        store=store,
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
    )
    index_service = IndexService(
        store=IndexStore(data_dir),
        document_store=store,
        vector_dim=settings.vector_dim,
    )
    retriever = RetrieverService(index_service)
    evidence_fusion = EvidenceFusionService()
    return _EvalServices(
        document_service=document_service,
        index_service=index_service,
        retriever=retriever,
        evidence_fusion=evidence_fusion,
    )


def _ingest_documents(
    document_service: DocumentService,
    documents: Sequence[EvalDocument],
    max_upload_mb: int,
) -> None:
    for document in documents:
        payload = document.content.encode("utf-8")
        doc = document_service.create_document(
            document.filename,
            payload,
            title=document.title,
            source=document.source,
            meta=document.meta,
            max_upload_mb=max_upload_mb,
        )
        document_service.process_document(doc.doc_id)


def _build_relevance(
    chunks: Sequence[Dict[str, Any]],
    expected_evidence: Sequence[str],
) -> List[int]:
    relevance: List[int] = []
    for item in chunks:
        text = str(item.get("text", ""))
        relevance.append(1 if _matches_any(text, expected_evidence) else 0)
    return relevance


def _expected_hits(
    items: Sequence[Dict[str, Any]],
    expected_evidence: Sequence[str],
) -> List[int]:
    hits: List[int] = []
    for idx, expected in enumerate(expected_evidence):
        for item in items:
            if _matches_any(str(item.get("text", "")), [expected]):
                hits.append(idx)
                break
    return hits


def _matches_any(text: str, expected_evidence: Sequence[str]) -> bool:
    if not expected_evidence:
        return False
    normalized_text = _normalize(text)
    for expected in expected_evidence:
        normalized_expected = _normalize(expected)
        if normalized_expected and normalized_expected in normalized_text:
            return True
    return False


def _normalize(text: str) -> str:
    return " ".join(text.lower().split())
