from __future__ import annotations

import argparse
import csv
import json
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

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


def run_evaluation(
    dataset_path: str,
    data_dir: str,
    output_dir: str,
    settings: Optional[Settings] = None,
) -> Dict[str, Any]:
    settings = settings or Settings.from_env()
    dataset = load_dataset(dataset_path)
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

    report = {"summary": summary, "samples": sample_rows}
    _write_report(report, output_dir)
    return report


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


def load_dataset(path: str) -> EvalDataset:
    dataset_path = Path(path)
    if not dataset_path.exists():
        raise FileNotFoundError(f"dataset not found: {dataset_path}")

    if dataset_path.suffix.lower() == ".jsonl":
        samples = _load_samples_jsonl(dataset_path)
        return EvalDataset(documents=[], samples=samples, defaults={})

    if dataset_path.suffix.lower() == ".json":
        payload = json.loads(dataset_path.read_text(encoding="utf-8"))
        documents = _load_documents(payload.get("documents", []))
        defaults = payload.get("defaults", {}) or {}
        samples = _load_samples(payload.get("samples", []), defaults)
        return EvalDataset(documents=documents, samples=samples, defaults=defaults)

    raise ValueError("dataset must be .json or .jsonl")


def _load_documents(items: Sequence[Dict[str, Any]]) -> List[EvalDocument]:
    documents: List[EvalDocument] = []
    for item in items:
        documents.append(
            EvalDocument(
                filename=str(item.get("filename", "doc.txt")),
                content=str(item.get("content", "")),
                title=item.get("title"),
                source=item.get("source"),
                meta=item.get("meta"),
            )
        )
    return documents


def _load_samples_jsonl(path: Path) -> List[EvalSample]:
    samples: List[EvalSample] = []
    with path.open("r", encoding="utf-8") as handle:
        for idx, line in enumerate(handle, start=1):
            payload = json.loads(line)
            sample_id = str(payload.get("id") or f"sample-{idx}")
            samples.append(
                EvalSample(
                    sample_id=sample_id,
                    query=str(payload.get("query", "")),
                    expected_evidence=_expected_list(payload),
                    top_k=int(payload.get("top_k", 5)),
                    rerank_k=int(payload.get("rerank_k", 20)),
                    max_evidence=int(payload.get("max_evidence", 5)),
                )
            )
    return samples


def _load_samples(items: Sequence[Dict[str, Any]], defaults: Dict[str, Any]) -> List[EvalSample]:
    samples: List[EvalSample] = []
    for idx, item in enumerate(items, start=1):
        sample_id = str(item.get("id") or f"sample-{idx}")
        samples.append(
            EvalSample(
                sample_id=sample_id,
                query=str(item.get("query", "")),
                expected_evidence=_expected_list(item),
                top_k=int(item.get("top_k", defaults.get("top_k", 5))),
                rerank_k=int(item.get("rerank_k", defaults.get("rerank_k", 20))),
                max_evidence=int(item.get("max_evidence", defaults.get("max_evidence", 5))),
            )
        )
    return samples


def _expected_list(item: Dict[str, Any]) -> List[str]:
    expected = item.get("expected_evidence")
    if expected is None:
        expected = item.get("evidence", [])
    if expected is None:
        expected = []
    return [str(value) for value in expected if value]


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


def _write_report(report: Dict[str, Any], output_dir: str) -> None:
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    json_path = output_path / "report.json"
    json_path.write_text(json.dumps(report, ensure_ascii=True, indent=2), encoding="utf-8")

    csv_path = output_path / "report.csv"
    rows = report.get("samples", [])
    if not rows:
        csv_path.write_text("", encoding="utf-8")
        return
    fieldnames = list(rows[0].keys())
    with csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run retrieval evaluation")
    parser.add_argument("--dataset", required=True, help="Path to dataset json/jsonl")
    parser.add_argument("--data-dir", default="data", help="Document data directory")
    parser.add_argument("--output-dir", default="reports", help="Report output directory")
    args = parser.parse_args()

    run_evaluation(args.dataset, args.data_dir, args.output_dir)


if __name__ == "__main__":
    main()
