from __future__ import annotations

from typing import Dict, Iterable, List


def build_prompt(question: str, evidence: Iterable[Dict[str, object]], *, allow_web_search: bool = False) -> str:
    if allow_web_search:
        header = (
            "You are a QA assistant. Use the evidence when possible. "
            "If evidence is insufficient, you may use the $web_search tool to search the web."
        )
    else:
        header = "You are a QA assistant. Answer only using the evidence."

    lines: List[str] = [
        header,
        f"Question: {question}",
        "Evidence:",
    ]
    for item in evidence:
        chunk_id = item.get("chunk_id", "")
        path = item.get("path", "")
        text = str(item.get("text", "")).strip()
        lines.append(f"- [{chunk_id}] {path} | {text}")
    lines.append("Answer:")
    return "\n".join(lines)


def build_structured_prompt(
    question: str,
    evidence: Iterable[Dict[str, object]],
    *,
    allow_web_search: bool = False,
    include_graph: bool = True,
    include_thought_steps: bool = True,
    conversation_history: Iterable[Dict[str, str]] | None = None,
) -> str:
    """Build a prompt that asks the LLM to return a JSON object for parsing."""

    if allow_web_search:
        header = (
            "You are a QA assistant. Use the evidence when possible. "
            "If evidence is insufficient, you may use the $web_search tool to search the web."
        )
    else:
        header = "You are a QA assistant. Answer only using the evidence."

    schema_lines: List[str] = [
        "Return ONLY a valid JSON object. Do not wrap it in markdown.",
        "JSON schema:",
        "{",
        '  "answer": "string",',
    ]
    if include_thought_steps:
        schema_lines.append('  "thought_steps": ["string", "..."],')
    if include_graph:
        schema_lines.extend(
            [
                '  "graph": {',
                '    "nodes": [',
                '      {"id": "string", "label": "string", "type": "document|concept", "metadata": {}}',
                "    ],",
                '    "edges": [',
                '      {"id": "optional", "source": "node_id", "target": "node_id"}',
                "    ]",
                "  }",
            ]
        )
    schema_lines.append("}")

    rules: List[str] = [
        "Rules:",
        "- Keep `answer` concise and user-facing (same language as the question).",
        "- Do NOT include hidden chain-of-thought; if you include `thought_steps`, keep them high-level.",
        "- If you output a graph, prefer using evidence chunk_id as node.id for evidence nodes.",
        "- Use conversation history for context continuity, but keep factual claims grounded in evidence.",
    ]

    lines: List[str] = [
        header,
        *schema_lines,
        *rules,
        "Conversation history:",
        *_format_history(conversation_history),
        f"Question: {question}",
        "Evidence:",
    ]
    for item in evidence:
        chunk_id = item.get("chunk_id", "")
        path = item.get("path", "")
        text = str(item.get("text", "")).strip()
        lines.append(f"- [{chunk_id}] {path} | {text}")
    return "\n".join(lines)


def summarize_evidence(evidence: Iterable[Dict[str, object]], max_chars: int = 200) -> str:
    lines: List[str] = ["Evidence summary:"]
    for item in evidence:
        text = str(item.get("text", "")).strip()
        if len(text) > max_chars:
            text = text[:max_chars].rstrip() + "..."
        lines.append(f"- {text}")
    return "\n".join(lines)


def _format_history(history: Iterable[Dict[str, str]] | None) -> List[str]:
    if not history:
        return ["- (none)"]

    lines: List[str] = []
    for item in history:
        role = str(item.get("role", "")).strip().lower()
        content = str(item.get("content", "")).strip()
        if role not in {"user", "assistant"} or not content:
            continue
        lines.append(f"- {role}: {content}")

    return lines or ["- (none)"]
