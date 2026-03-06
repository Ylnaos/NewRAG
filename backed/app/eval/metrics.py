from __future__ import annotations

import math
from typing import Iterable, Sequence


def mean(values: Sequence[float]) -> float:
    if not values:
        return 0.0
    return sum(values) / len(values)


def mrr(relevance: Sequence[int]) -> float:
    for idx, rel in enumerate(relevance, start=1):
        if rel > 0:
            return 1.0 / idx
    return 0.0


def ndcg(relevance: Sequence[int]) -> float:
    if not relevance:
        return 0.0
    dcg = _dcg(relevance)
    ideal = sorted(relevance, reverse=True)
    idcg = _dcg(ideal)
    if idcg == 0:
        return 0.0
    return dcg / idcg


def percentile(values: Sequence[float], ratio: float) -> float:
    if not values:
        return 0.0
    if ratio <= 0:
        return min(values)
    if ratio >= 1:
        return max(values)
    ordered = sorted(values)
    index = int(math.ceil(ratio * len(ordered))) - 1
    index = max(0, min(index, len(ordered) - 1))
    return ordered[index]


def _dcg(relevance: Iterable[int]) -> float:
    score = 0.0
    for idx, rel in enumerate(relevance, start=1):
        if rel <= 0:
            continue
        score += rel / math.log2(idx + 1)
    return score
