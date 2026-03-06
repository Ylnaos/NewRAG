from __future__ import annotations

from typing import Dict, List, Tuple

from app.core.weights import RetrievalWeights
from app.index.bm25 import BM25Indexer
from app.index.service import IndexService
from app.index.tokenizer import tokenize
from app.index.vector import VectorIndexer


class RetrieverService:
    def __init__(self, index_service: IndexService, weights: RetrievalWeights | None = None) -> None:
        self._index_service = index_service
        self._weights = weights or RetrievalWeights()

    def retrieve(
        self,
        query: str,
        top_k: int = 5,
        rerank_k: int = 20,
        *,
        structure_prior_enabled: bool = True,
    ) -> Dict[str, List[Dict[str, object]]]:
        data = self._index_service.load_current()
        if data is None:
            raise ValueError("index not ready")
        corpus: List[Dict[str, object]] = data.get("corpus", [])
        if not corpus:
            return {"coarse_sections": [], "fine_chunks": []}

        bm25_scores = BM25Indexer.score(query, data.get("bm25", {}))
        vector_data = data.get("vector", {})
        vector_dim = int(vector_data.get("dim", 128))
        vector_scores = VectorIndexer(vector_dim).score(query, vector_data)

        combined = self._combine_scores(
            query,
            bm25_scores,
            vector_scores,
            corpus,
            structure_prior_enabled=structure_prior_enabled,
        )
        coarse_sections = self._coarse_rank(combined, corpus, top_k)

        reranked = self._rerank(query, combined, corpus, rerank_k)
        fine_chunks = reranked[:top_k]

        return {"coarse_sections": coarse_sections, "fine_chunks": fine_chunks}

    def _combine_scores(
        self,
        query: str,
        bm25_scores: List[Tuple[int, float]],
        vector_scores: List[Tuple[int, float]],
        corpus: List[Dict[str, object]],
        *,
        structure_prior_enabled: bool,
    ) -> Dict[int, float]:
        bm25_map = {idx: score for idx, score in bm25_scores}
        vector_map = {idx: score for idx, score in vector_scores}

        bm25_norm = _normalize(bm25_map)
        vector_norm = _normalize(vector_map)
        weights = self._weights.normalized()

        query_tokens = set(tokenize(query))
        combined: Dict[int, float] = {}
        for idx in range(len(corpus)):
            sparse = bm25_norm.get(idx, 0.0)
            dense = vector_norm.get(idx, 0.0)
            path = str(corpus[idx].get("path", ""))
            structure = _structure_prior(query_tokens, path) if structure_prior_enabled else 0.0
            combined[idx] = (
                weights.sparse_weight * sparse
                + weights.dense_weight * dense
                + weights.structure_weight * structure
            )
        return combined

    def _coarse_rank(
        self,
        combined: Dict[int, float],
        corpus: List[Dict[str, object]],
        top_k: int,
    ) -> List[Dict[str, object]]:
        section_scores: Dict[str, Dict[str, object]] = {}
        for idx, score in combined.items():
            item = corpus[idx]
            section_id = str(item.get("section_id", ""))
            existing = section_scores.get(section_id)
            if existing is None or score > float(existing["score"]):
                section_scores[section_id] = {
                    "section_id": section_id,
                    "doc_id": item.get("doc_id"),
                    "path": item.get("path"),
                    "score": score,
                    "chunk_id": item.get("chunk_id"),
                }
        ranked = sorted(section_scores.values(), key=lambda item: item["score"], reverse=True)
        return ranked[:top_k]

    def _rerank(
        self,
        query: str,
        combined: Dict[int, float],
        corpus: List[Dict[str, object]],
        rerank_k: int,
    ) -> List[Dict[str, object]]:
        candidates = sorted(combined.items(), key=lambda item: item[1], reverse=True)[:rerank_k]
        query_tokens = set(tokenize(query))
        reranked: List[Dict[str, object]] = []
        weights = self._weights.normalized()
        for idx, coarse_score in candidates:
            item = corpus[idx]
            text = str(item.get("text", ""))
            overlap = _overlap_score(query_tokens, text)
            fine_score = weights.overlap_weight * overlap + weights.coarse_weight * coarse_score
            reranked.append(
                {
                    "chunk_id": item.get("chunk_id"),
                    "doc_id": item.get("doc_id"),
                    "section_id": item.get("section_id"),
                    "path": item.get("path"),
                    "text": text,
                    "score": fine_score,
                    "order": item.get("order"),
                }
            )
        reranked.sort(key=lambda item: item["score"], reverse=True)
        return reranked

    def update_weights(self, weights: RetrievalWeights) -> None:
        self._weights = weights


def _normalize(scores: Dict[int, float]) -> Dict[int, float]:
    if not scores:
        return {}
    values = list(scores.values())
    min_val = min(values)
    max_val = max(values)
    if max_val == min_val:
        return {idx: 0.0 for idx in scores}
    return {idx: (score - min_val) / (max_val - min_val) for idx, score in scores.items()}


def _structure_prior(query_tokens: set[str], path: str) -> float:
    if not query_tokens or not path:
        return 0.0
    path_tokens = set(tokenize(path))
    if not path_tokens:
        return 0.0
    return len(query_tokens.intersection(path_tokens)) / max(len(query_tokens), 1)


def _overlap_score(query_tokens: set[str], text: str) -> float:
    if not query_tokens:
        return 0.0
    text_tokens = set(tokenize(text))
    if not text_tokens:
        return 0.0
    return len(query_tokens.intersection(text_tokens)) / max(len(query_tokens), 1)