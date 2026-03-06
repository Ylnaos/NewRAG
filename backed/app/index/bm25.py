from __future__ import annotations

import math
from typing import Dict, List, Tuple

from .tokenizer import tokenize


class BM25Indexer:
    def __init__(self, k1: float = 1.5, b: float = 0.75) -> None:
        self._k1 = k1
        self._b = b

    def build(self, texts: List[str], doc_ids: List[str]) -> Dict[str, object]:
        if len(texts) != len(doc_ids):
            raise ValueError("texts and doc_ids length mismatch")
        doc_len: List[int] = []
        postings: Dict[str, List[List[int]]] = {}
        doc_freq: Dict[str, int] = {}

        for idx, text in enumerate(texts):
            tokens = tokenize(text)
            doc_len.append(len(tokens))
            tf: Dict[str, int] = {}
            for token in tokens:
                tf[token] = tf.get(token, 0) + 1
            for token, count in tf.items():
                postings.setdefault(token, []).append([idx, count])
                doc_freq[token] = doc_freq.get(token, 0) + 1

        total_docs = len(texts)
        avgdl = sum(doc_len) / total_docs if total_docs else 0
        idf: Dict[str, float] = {}
        for token, df in doc_freq.items():
            idf[token] = math.log(1 + (total_docs - df + 0.5) / (df + 0.5))

        return {
            "doc_ids": doc_ids,
            "doc_len": doc_len,
            "avgdl": avgdl,
            "idf": idf,
            "postings": postings,
            "k1": self._k1,
            "b": self._b,
        }

    @staticmethod
    def score(query: str, index_data: Dict[str, object]) -> List[Tuple[int, float]]:
        tokens = tokenize(query)
        if not tokens:
            return []
        doc_len = index_data.get("doc_len", [])
        avgdl = index_data.get("avgdl", 0.0) or 0.0
        idf = index_data.get("idf", {})
        postings = index_data.get("postings", {})
        k1 = index_data.get("k1", 1.5)
        b = index_data.get("b", 0.75)

        scores: Dict[int, float] = {}
        for token in tokens:
            token_idf = idf.get(token)
            if token_idf is None:
                continue
            for doc_idx, tf in postings.get(token, []):
                dl = doc_len[doc_idx] if doc_idx < len(doc_len) else 0
                denom = tf + k1 * (1 - b + b * (dl / avgdl)) if avgdl > 0 else 1
                score = token_idf * (tf * (k1 + 1)) / denom
                scores[doc_idx] = scores.get(doc_idx, 0.0) + score

        return sorted(scores.items(), key=lambda item: item[1], reverse=True)
