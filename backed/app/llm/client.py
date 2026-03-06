from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Optional

from app.llm.moonshot import MoonshotError, generate_chat_completion, list_models as moonshot_list_models


@dataclass(frozen=True)
class LLMGenerateResult:
    text: str
    reasoning_content: Optional[str] = None


@dataclass
class LLMClient:
    mode: str = "mock"
    base_url: str = ""
    api_key: str = ""
    model_id: str = ""
    enable_web_search: bool = False
    enable_thinking: bool = False

    def generate(self, prompt: str, temperature: float = 0.2, max_tokens: int = 512) -> str:
        return self.generate_with_meta(prompt, temperature=temperature, max_tokens=max_tokens).text

    def generate_with_meta(
        self,
        prompt: str,
        temperature: float = 0.2,
        max_tokens: int = 512,
        *,
        enable_web_search: Optional[bool] = None,
        enable_thinking: Optional[bool] = None,
    ) -> LLMGenerateResult:
        mode = (self.mode or "").lower()
        if mode == "disabled":
            raise RuntimeError("LLM disabled")
        if mode == "mock":
            return LLMGenerateResult(text=_mock_generate(prompt))
        if mode == "moonshot":
            web_search = self.enable_web_search if enable_web_search is None else bool(enable_web_search)
            thinking = self.enable_thinking if enable_thinking is None else bool(enable_thinking)
            try:
                result = generate_chat_completion(
                    self.base_url,
                    self.api_key,
                    model=self.model_id,
                    user_prompt=prompt,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    enable_web_search=web_search,
                )
            except MoonshotError as exc:
                # Avoid leaking request details (headers, full URLs, etc.).
                raise RuntimeError(str(exc)) from exc
            return LLMGenerateResult(
                text=result.text,
                reasoning_content=result.reasoning_content if thinking else None,
            )
        raise NotImplementedError(f"LLM mode not implemented: {mode}")

    def list_models(self) -> list[dict]:
        mode = (self.mode or "").lower()
        if mode == "moonshot":
            try:
                return moonshot_list_models(self.base_url, self.api_key)
            except MoonshotError as exc:
                raise RuntimeError(str(exc)) from exc
        if mode in {"mock", "disabled"}:
            return []
        raise NotImplementedError(f"LLM mode not implemented: {mode}")

    def embed(self, texts: list[str]) -> list[list[float]]:
        raise NotImplementedError("embedding not implemented")

    def rerank(self, query: str, passages: list[str]) -> list[float]:
        raise NotImplementedError("rerank not implemented")


def _mock_generate(prompt: str) -> str:
    lines = [line.strip() for line in prompt.splitlines() if line.strip()]
    # Only treat our evidence bullet format as "evidence" (avoid picking up other "-" rule bullets).
    evidence_lines = [line for line in lines if line.startswith("- [")]
    if evidence_lines:
        line = evidence_lines[0]
        if "]" in line:
            line = line.split("]", 1)[1].strip()
        answer = f"Based on evidence: {line}"
    else:
        answer = "No evidence available to answer."

    if "Return ONLY a valid JSON object." in prompt:
        return json.dumps(
            {
                "answer": answer,
                "thought_steps": ["mock: parsed prompt", "mock: selected evidence", "mock: drafted answer"],
            },
            ensure_ascii=False,
        )

    return answer
