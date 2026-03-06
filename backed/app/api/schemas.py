from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class QAHistoryTurn(BaseModel):
    role: Literal["user", "assistant"] = Field(...)
    content: str = Field(..., min_length=1, max_length=4000)


class QARequest(BaseModel):
    query: str = Field(..., min_length=1)
    top_k: int = Field(5, ge=1, le=50)
    rerank_k: int = Field(20, ge=1, le=200)
    max_evidence: int = Field(5, ge=1, le=20)
    history: List[QAHistoryTurn] = Field(default_factory=list, max_length=16)
    structure_prior_enabled: bool = True


class FeedbackRequest(BaseModel):
    answer_id: str = Field(..., min_length=1)
    node_id: str = Field(..., min_length=1)
    score: int = Field(..., ge=0, le=5)
    comment: Optional[str] = None
    doc_id: Optional[str] = None
    uncertain: Optional[bool] = None
    conflict: Optional[bool] = None
    evidence_ids: List[str] = Field(default_factory=list)


class IndexBuildRequest(BaseModel):
    async_process: bool = False


class LLMConfigRequest(BaseModel):
    base_url: Optional[str] = None
    model_id: Optional[str] = None
    mode: Optional[str] = None
    enable_web_search: Optional[bool] = None
    enable_thinking: Optional[bool] = None
    api_key: Optional[str] = None


class ArchiveDocumentRequest(BaseModel):
    archive_path: Optional[str] = None


class RetrievalWeightsIn(BaseModel):
    sparse_weight: Optional[float] = Field(None, ge=0, le=1)
    dense_weight: Optional[float] = Field(None, ge=0, le=1)
    structure_weight: Optional[float] = Field(None, ge=0, le=1)
    overlap_weight: Optional[float] = Field(None, ge=0, le=1)
    coarse_weight: Optional[float] = Field(None, ge=0, le=1)


class EvidenceWeightsIn(BaseModel):
    match_weight: Optional[float] = Field(None, ge=0, le=1)
    consistency_weight: Optional[float] = Field(None, ge=0, le=1)
    diversity_weight: Optional[float] = Field(None, ge=0, le=1)
    candidate_weight: Optional[float] = Field(None, ge=0, le=1)
    confidence_weight: Optional[float] = Field(None, ge=0, le=1)
    redundancy_penalty: Optional[float] = Field(None, ge=0, le=1)


class ModelWeightsRequest(BaseModel):
    retrieval: Optional[RetrievalWeightsIn] = None
    evidence: Optional[EvidenceWeightsIn] = None


class EvalDocumentIn(BaseModel):
    filename: str = Field(..., min_length=1)
    content: str = Field(..., min_length=1)
    title: Optional[str] = None
    source: Optional[str] = None
    meta: Optional[Dict[str, Any]] = None


class EvalSampleIn(BaseModel):
    sample_id: Optional[str] = None
    query: str = Field(..., min_length=1)
    expected_evidence: Optional[List[str]] = None
    top_k: int = Field(5, ge=1, le=50)
    rerank_k: int = Field(20, ge=1, le=200)
    max_evidence: int = Field(5, ge=1, le=20)


class EvalRunRequest(BaseModel):
    documents: List[EvalDocumentIn] = Field(default_factory=list)
    samples: List[EvalSampleIn] = Field(default_factory=list)
    defaults: Dict[str, Any] = Field(default_factory=dict)