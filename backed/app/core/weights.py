from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict


def _clamp(value: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
    return max(minimum, min(maximum, value))


@dataclass
class RetrievalWeights:
    sparse_weight: float = 0.45
    dense_weight: float = 0.45
    structure_weight: float = 0.1
    overlap_weight: float = 0.6
    coarse_weight: float = 0.4

    def to_dict(self) -> Dict[str, float]:
        return {
            "sparse_weight": self.sparse_weight,
            "dense_weight": self.dense_weight,
            "structure_weight": self.structure_weight,
            "overlap_weight": self.overlap_weight,
            "coarse_weight": self.coarse_weight,
        }

    def normalized(self) -> "RetrievalWeights":
        sparse = _clamp(self.sparse_weight)
        dense = _clamp(self.dense_weight)
        structure = _clamp(self.structure_weight)
        total = sparse + dense + structure
        if total <= 0:
            sparse, dense, structure = 0.45, 0.45, 0.1
            total = 1.0
        overlap = _clamp(self.overlap_weight)
        coarse = _clamp(self.coarse_weight)
        rerank_total = overlap + coarse
        if rerank_total <= 0:
            overlap, coarse, rerank_total = 0.6, 0.4, 1.0
        return RetrievalWeights(
            sparse_weight=sparse / total,
            dense_weight=dense / total,
            structure_weight=structure / total,
            overlap_weight=overlap / rerank_total,
            coarse_weight=coarse / rerank_total,
        )

    def merge(self, payload: Dict[str, float]) -> None:
        for key, value in payload.items():
            if value is None:
                continue
            if hasattr(self, key):
                setattr(self, key, float(value))


@dataclass
class EvidenceWeights:
    match_weight: float = 0.5
    consistency_weight: float = 0.3
    diversity_weight: float = 0.2
    candidate_weight: float = 0.6
    confidence_weight: float = 0.4
    redundancy_penalty: float = 0.7

    def to_dict(self) -> Dict[str, float]:
        return {
            "match_weight": self.match_weight,
            "consistency_weight": self.consistency_weight,
            "diversity_weight": self.diversity_weight,
            "candidate_weight": self.candidate_weight,
            "confidence_weight": self.confidence_weight,
            "redundancy_penalty": self.redundancy_penalty,
        }

    def normalized(self) -> "EvidenceWeights":
        match = _clamp(self.match_weight)
        consistency = _clamp(self.consistency_weight)
        diversity = _clamp(self.diversity_weight)
        total = match + consistency + diversity
        if total <= 0:
            match, consistency, diversity, total = 0.5, 0.3, 0.2, 1.0
        candidate = _clamp(self.candidate_weight)
        confidence = _clamp(self.confidence_weight)
        score_total = candidate + confidence
        if score_total <= 0:
            candidate, confidence, score_total = 0.6, 0.4, 1.0
        penalty = _clamp(self.redundancy_penalty, minimum=0.1, maximum=1.0)
        return EvidenceWeights(
            match_weight=match / total,
            consistency_weight=consistency / total,
            diversity_weight=diversity / total,
            candidate_weight=candidate / score_total,
            confidence_weight=confidence / score_total,
            redundancy_penalty=penalty,
        )

    def merge(self, payload: Dict[str, float]) -> None:
        for key, value in payload.items():
            if value is None:
                continue
            if hasattr(self, key):
                setattr(self, key, float(value))


@dataclass
class ModelWeights:
    retrieval: RetrievalWeights = field(default_factory=RetrievalWeights)
    evidence: EvidenceWeights = field(default_factory=EvidenceWeights)

    def to_dict(self) -> Dict[str, Dict[str, float]]:
        return {
            "retrieval": self.retrieval.to_dict(),
            "evidence": self.evidence.to_dict(),
        }

    @classmethod
    def from_dict(cls, payload: Dict[str, Dict[str, float]]) -> "ModelWeights":
        retrieval = RetrievalWeights()
        evidence = EvidenceWeights()
        retrieval.merge(payload.get("retrieval", {}) or {})
        evidence.merge(payload.get("evidence", {}) or {})
        return cls(retrieval=retrieval, evidence=evidence)
