from __future__ import annotations

import hashlib
import math
from typing import Dict, List, Tuple

from .tokenizer import tokenize


def _stable_hash(text: str) -> int:
    digest = hashlib.md5(text.encode("utf-8")).hexdigest()
    return int(digest, 16)


class VectorIndexer:
    def __init__(self, dim: int = 128) -> None:
        self._dim = dim

    def build(self, texts: List[str], doc_ids: List[str]) -> Dict[str, object]:
        if len(texts) != len(doc_ids):
            raise ValueError("texts and doc_ids length mismatch")
        vectors = [self._embed(text) for text in texts]
        return {"doc_ids": doc_ids, "dim": self._dim, "vectors": vectors}

    def _embed(self, text: str) -> List[float]:
        vec = [0.0] * self._dim
        tokens = tokenize(text)
        for token in tokens:
            h = _stable_hash(token)
            idx = h % self._dim
            sign = 1.0 if (h // self._dim) % 2 == 0 else -1.0
            vec[idx] += sign
        return _normalize(vec)

    def score(self, query: str, index_data: Dict[str, object]) -> List[Tuple[int, float]]:
        query_vec = self._embed(query)
        vectors = index_data.get("vectors", [])
        scores: List[Tuple[int, float]] = []
        for idx, vec in enumerate(vectors):
            scores.append((idx, _dot(query_vec, vec)))
        scores.sort(key=lambda item: item[1], reverse=True)
        return scores


def _normalize(vec: List[float]) -> List[float]:
    norm = math.sqrt(sum(value * value for value in vec))
    if norm == 0:
        return vec
    return [value / norm for value in vec]


def _dot(a: List[float], b: List[float]) -> float:
    return sum(x * y for x, y in zip(a, b))
