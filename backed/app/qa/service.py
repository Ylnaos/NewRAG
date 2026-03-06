from __future__ import annotations

from typing import Dict, List, Optional

from app.evidence.service import EvidenceFusionService
from app.llm.client import LLMClient
from app.qa.prompt import build_structured_prompt, summarize_evidence
from app.qa.structured_output import parse_qa_output
from app.retriever.service import RetrieverService
from app.verify.service import AnswerVerifier


class QAService:
    def __init__(
        self,
        retriever: RetrieverService,
        evidence_fusion: EvidenceFusionService,
        llm_client: LLMClient,
        verifier: AnswerVerifier,
    ) -> None:
        self._retriever = retriever
        self._evidence_fusion = evidence_fusion
        self._llm_client = llm_client
        self._verifier = verifier

    def answer(
        self,
        query: str,
        top_k: int = 5,
        rerank_k: int = 20,
        max_evidence: int = 5,
        history: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, object]:
        retrieval = self._retriever.retrieve(query, top_k=top_k, rerank_k=rerank_k)
        fine_chunks: List[Dict[str, object]] = retrieval.get("fine_chunks", [])
        evidence = self._evidence_fusion.fuse(query, fine_chunks, max_evidence=max_evidence)
        conversation_history = _normalize_history(history)
        memory_evidence = _history_to_evidence(conversation_history)
        generation_candidates = [*memory_evidence, *evidence]

        # Avoid confusing the LLM with explicitly conflicting/redundant evidence.
        # We still return the full evidence list to the caller for transparency.
        generation_evidence = [
            item
            for item in generation_candidates
            if not item.get("conflict_flag") and not item.get("redundant_flag")
        ] or list(generation_candidates)

        # Only allow $web_search when we have no local evidence.
        # This avoids unnecessary tool-call loops (and rate limits) for in-corpus questions.
        allow_web_search = bool(self._llm_client.enable_web_search) and not generation_evidence
        prompt = build_structured_prompt(
            query,
            generation_evidence,
            allow_web_search=allow_web_search,
            conversation_history=conversation_history,
        )
        answer = ""
        reasoning_content: Optional[str] = None
        thought_steps: List[str] = []
        graph: Optional[Dict[str, object]] = None
        fallback_reason = ""
        verify_result = {"status": "FAIL", "overlap": 0.0}
        verify_status = "PASS"

        try:
            generation = self._llm_client.generate_with_meta(
                prompt,
                temperature=0.2,
                max_tokens=512,
                enable_web_search=allow_web_search,
            )
            parsed = parse_qa_output(generation.text)
            answer = parsed.answer or generation.text
            thought_steps = parsed.thought_steps
            graph = parsed.graph
            reasoning_content = generation.reasoning_content
        except Exception as exc:  # noqa: BLE001
            # Preserve a short, sanitized error message for the UI without leaking request headers/keys.
            detail = " ".join(str(exc).split())
            fallback_reason = f"llm_error:{type(exc).__name__}"
            if detail:
                fallback_reason = f"{fallback_reason}:{detail[:200]}"

        if not answer.strip():
            fallback_reason = fallback_reason or "empty_answer"

        if not fallback_reason:
            verify_result = self._verifier.verify(answer, generation_evidence)
            if verify_result.get("status") != "PASS":
                if allow_web_search:
                    # When web search is enabled, allow answers that go beyond local evidence,
                    # but still expose verification details to the caller.
                    verify_status = "UNVERIFIED"
                elif memory_evidence and _is_conversational_memory_query(query):
                    # Follow-up memory questions ("what did I just say?") rely on chat turns
                    # that may not overlap strongly with indexed corpus tokens.
                    verify_status = "MEMORY"
                else:
                    fallback_reason = "verification_failed"

        if fallback_reason:
            answer = summarize_evidence(generation_evidence)
            verify_status = "FALLBACK"
            reasoning_content = None
            thought_steps = []
            graph = None

        citations = [
            {
                "chunk_id": item.get("chunk_id"),
                "doc_id": item.get("doc_id"),
                "path": item.get("path"),
                "score": item.get("score"),
            }
            for item in generation_evidence
        ]

        return {
            "answer": answer,
            "reasoning_content": reasoning_content,
            "thought_steps": thought_steps,
            "graph": graph,
            "evidence": evidence,
            "citations": citations,
            "verify_status": verify_status,
            "verify_detail": verify_result,
            "fallback_reason": fallback_reason,
            "coarse_sections": retrieval.get("coarse_sections", []),
        }


def _normalize_history(history: Optional[List[Dict[str, str]]], *, max_turns: int = 12) -> List[Dict[str, str]]:
    if not history:
        return []

    turns: List[Dict[str, str]] = []
    for item in history[-max_turns:]:
        if not isinstance(item, dict):
            continue
        role = str(item.get("role", "")).strip().lower()
        if role not in {"user", "assistant"}:
            continue
        content = str(item.get("content", "")).strip()
        if not content:
            continue
        if len(content) > 1000:
            content = f"{content[:1000].rstrip()}..."
        turns.append({"role": role, "content": content})
    return turns


def _history_to_evidence(history: List[Dict[str, str]], *, max_items: int = 6) -> List[Dict[str, object]]:
    if not history:
        return []

    selected = history[-max_items:]
    base_order = max(1, len(selected))
    evidence: List[Dict[str, object]] = []
    for index, turn in enumerate(selected):
        role = turn["role"]
        content = turn["content"]
        chunk_id = f"conversation-{index + 1}-{role}"
        snippet = content if len(content) <= 240 else f"{content[:240].rstrip()}..."
        evidence.append(
            {
                "chunk_id": chunk_id,
                "doc_id": "conversation-memory",
                "section_id": chunk_id,
                "path": f"conversation/{role}",
                "text": content,
                "order": base_order + index,
                "score": 0.95 if role == "user" else 0.85,
                "redundant_flag": False,
                "conflict_flag": False,
                "confidence": 0.95,
                "snippet": snippet,
            }
        )
    return evidence


def _is_conversational_memory_query(query: str) -> bool:
    text = (query or "").strip().lower()
    if not text:
        return False

    markers = (
        "刚刚",
        "上一句",
        "上一条",
        "上一个",
        "之前说",
        "你记得",
        "remember",
        "previous",
        "earlier",
        "last message",
        "what did i say",
    )
    return any(marker in text for marker in markers)
