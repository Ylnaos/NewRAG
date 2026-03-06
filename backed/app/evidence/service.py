from __future__ import annotations

import re
from typing import Dict, List, Sequence

from app.core.weights import EvidenceWeights
from app.index.tokenizer import tokenize

_NUMBER_RE = re.compile(r"\d+(?:\.\d+)?")


class EvidenceFusionService:
    def __init__(
        self,
        redundancy_threshold: float = 0.8,
        conflict_overlap: float = 0.2,
        weights: EvidenceWeights | None = None,
    ) -> None:
        self._redundancy_threshold = redundancy_threshold
        self._conflict_overlap = conflict_overlap
        self._weights = weights or EvidenceWeights()

    def fuse(
        self,
        query: str,
        candidates: Sequence[Dict[str, object]],
        max_evidence: int = 5,
    ) -> List[Dict[str, object]]:
        if not candidates:
            return []
        query_tokens = set(tokenize(query))
        normalized_scores = _normalize_scores(candidates)
        selected: List[Dict[str, object]] = []
        used_sections: set[str] = set()

        for idx, item in enumerate(candidates):
            text = str(item.get("text", ""))
            tokens = set(tokenize(text))
            candidate_score = normalized_scores.get(idx, 0.0)

            redundant = _is_redundant(tokens, selected, self._redundancy_threshold)
            conflict = _has_conflict(tokens, text, selected, self._conflict_overlap)

            match = _overlap(query_tokens, tokens)
            consistency = 0.2 if conflict else 1.0

            section_id = str(item.get("section_id", ""))
            diversity = 1.0 if section_id and section_id not in used_sections else 0.6

            weights = self._weights.normalized()
            confidence = (
                weights.match_weight * match
                + weights.consistency_weight * consistency
                + weights.diversity_weight * diversity
            )
            score = weights.candidate_weight * candidate_score + weights.confidence_weight * confidence
            if redundant:
                score *= weights.redundancy_penalty

            record = {
                "chunk_id": item.get("chunk_id"),
                "id": item.get("chunk_id"),
                "doc_id": item.get("doc_id"),
                "section_id": section_id,
                "path": item.get("path"),
                "text": text,
                "order": item.get("order"),
                "score": score,
                "redundant_flag": redundant,
                "conflict_flag": conflict,
                "confidence": confidence,
                "snippet": _build_snippet(text),
            }
            selected.append(record)
            if section_id:
                used_sections.add(section_id)
            if len(selected) >= max_evidence:
                break

        ranked = sorted(selected, key=lambda item: item["score"], reverse=True)
        for idx, item in enumerate(ranked, start=1):
            item["source_rank"] = idx
        return ranked

    def update_weights(self, weights: EvidenceWeights) -> None:
        self._weights = weights


def _normalize_scores(candidates: Sequence[Dict[str, object]]) -> Dict[int, float]:
    scores = [float(item.get("score", 0.0)) for item in candidates]
    if not scores:
        return {}
    min_val = min(scores)
    max_val = max(scores)
    if min_val == max_val:
        return {idx: 0.0 for idx in range(len(scores))}
    return {idx: (score - min_val) / (max_val - min_val) for idx, score in enumerate(scores)}


def _overlap(tokens_a: set[str], tokens_b: set[str]) -> float:
    if not tokens_a or not tokens_b:
        return 0.0
    return len(tokens_a.intersection(tokens_b)) / max(len(tokens_a), 1)


def _is_redundant(tokens: set[str], selected: List[Dict[str, object]], threshold: float) -> bool:
    for item in selected:
        existing_tokens = set(tokenize(str(item.get("text", ""))))
        if _jaccard(tokens, existing_tokens) >= threshold:
            return True
    return False


def _has_conflict(
    tokens: set[str],
    text: str,
    selected: List[Dict[str, object]],
    overlap_threshold: float,
) -> bool:
    numbers = set(_NUMBER_RE.findall(text))
    if not numbers:
        return False
    for item in selected:
        other_text = str(item.get("text", ""))
        other_tokens = set(tokenize(other_text))
        if _jaccard(tokens, other_tokens) < overlap_threshold:
            continue
        other_numbers = set(_NUMBER_RE.findall(other_text))
        if other_numbers and other_numbers != numbers:
            return True
    return False


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a.intersection(b)) / max(len(a.union(b)), 1)


def _build_snippet(text: str, max_len: int = 160) -> str:
    cleaned = " ".join(text.split())
    if len(cleaned) <= max_len:
        return cleaned
    return f"{cleaned[: max_len - 3]}..."
