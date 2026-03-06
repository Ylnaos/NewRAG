from __future__ import annotations

from typing import Dict, Sequence

from app.index.tokenizer import tokenize


class AnswerVerifier:
    def __init__(self, min_overlap: float = 0.1, min_tokens: int = 5) -> None:
        self._min_overlap = min_overlap
        self._min_tokens = min_tokens

    def verify(self, answer: str, evidence: Sequence[Dict[str, object]]) -> Dict[str, object]:
        if not evidence:
            return {"status": "FAIL", "overlap": 0.0, "reason": "no_evidence"}
        tokens = set(tokenize(answer))
        if not tokens:
            return {"status": "FAIL", "overlap": 0.0, "reason": "empty_answer"}

        evidence_tokens = set()
        for item in evidence:
            evidence_tokens.update(tokenize(str(item.get("text", ""))))
        if not evidence_tokens:
            return {"status": "FAIL", "overlap": 0.0, "reason": "empty_evidence"}

        overlap = len(tokens.intersection(evidence_tokens)) / max(len(tokens), 1)
        if overlap >= self._min_overlap:
            if len(tokens) >= self._min_tokens or self._allow_short_answer(tokens, overlap):
                return {"status": "PASS", "overlap": overlap}
            return {"status": "FAIL", "overlap": overlap, "reason": "answer_too_short"}
        return {"status": "FAIL", "overlap": overlap}

    @staticmethod
    def _allow_short_answer(tokens: set[str], overlap: float) -> bool:
        # Allow short answers (IDs/codes/names) when every token is supported by evidence.
        if overlap < 1.0:
            return False
        return any(token.isdigit() or len(token) >= 4 for token in tokens)
