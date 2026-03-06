from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


_DECODER = json.JSONDecoder()


@dataclass(frozen=True)
class ParsedQAOutput:
    answer: str = ""
    thought_steps: List[str] = field(default_factory=list)
    graph: Optional[Dict[str, Any]] = None
    citations: List[Dict[str, Any]] = field(default_factory=list)
    raw: Dict[str, Any] = field(default_factory=dict)
    parse_error: str = ""


def parse_qa_output(text: str) -> ParsedQAOutput:
    """Best-effort parser for LLM structured QA output.

    We instruct the LLM to return a single JSON object, but models may wrap it in
    code fences or add surrounding text; this parser is resilient to both.
    """

    payload = _extract_json(text)
    if not isinstance(payload, dict):
        return ParsedQAOutput(parse_error="not_json_object")

    answer = payload.get("answer") or payload.get("final_answer") or payload.get("response") or ""
    answer = str(answer).strip() if answer is not None else ""

    thought_steps = _normalize_steps(payload.get("thought_steps") or payload.get("thinking_steps"))
    graph = _normalize_graph(payload.get("graph") or payload.get("mindmap") or payload.get("diagram"))
    citations = _normalize_citations(payload.get("citations"))

    return ParsedQAOutput(
        answer=answer,
        thought_steps=thought_steps,
        graph=graph,
        citations=citations,
        raw=payload,
    )


def _extract_json(text: str) -> object:
    content = (text or "").strip()
    if not content:
        return None

    # 1) Direct JSON.
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        pass

    # 2) Code-fenced JSON blocks.
    fenced = _extract_first_fenced_block(content)
    if fenced:
        try:
            return json.loads(fenced)
        except json.JSONDecodeError:
            pass

    # 3) Scan for the first valid JSON value embedded in the text.
    for idx, ch in enumerate(content):
        if ch not in "{[":
            continue
        try:
            value, _ = _DECODER.raw_decode(content[idx:])
        except json.JSONDecodeError:
            continue
        return value

    return None


def _extract_first_fenced_block(text: str) -> str:
    marker = "```"
    start = text.find(marker)
    if start < 0:
        return ""
    end = text.find(marker, start + len(marker))
    if end < 0:
        return ""

    block = text[start + len(marker) : end]
    # Allow optional language tag on the first line, e.g. ```json
    lines = block.splitlines()
    if not lines:
        return ""
    if lines[0].strip().lower() in {"json", "application/json"}:
        lines = lines[1:]
    return "\n".join(lines).strip()


def _normalize_steps(value: object) -> List[str]:
    if not value:
        return []
    if isinstance(value, str):
        # Allow models to return a single multi-line string.
        return [line.strip() for line in value.splitlines() if line.strip()]
    if isinstance(value, list):
        steps: List[str] = []
        for item in value:
            if item is None:
                continue
            steps.append(str(item).strip())
        return [step for step in steps if step]
    return []


def _normalize_graph(value: object) -> Optional[Dict[str, Any]]:
    if not isinstance(value, dict):
        return None
    nodes = value.get("nodes")
    edges = value.get("edges")
    if not isinstance(nodes, list) or not isinstance(edges, list):
        return None

    clean_nodes: List[Dict[str, Any]] = []
    for node in nodes:
        if not isinstance(node, dict):
            continue
        node_id = node.get("id")
        if not node_id:
            continue
        clean_nodes.append({**node, "id": str(node_id)})

    clean_edges: List[Dict[str, Any]] = []
    for edge in edges:
        if not isinstance(edge, dict):
            continue
        source = edge.get("source")
        target = edge.get("target")
        if not source or not target:
            continue
        clean = {**edge, "source": str(source), "target": str(target)}
        if clean.get("id") is not None:
            clean["id"] = str(clean["id"])
        clean_edges.append(clean)

    return {**value, "nodes": clean_nodes, "edges": clean_edges}


def _normalize_citations(value: object) -> List[Dict[str, Any]]:
    if not isinstance(value, list):
        return []
    citations: List[Dict[str, Any]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        citations.append(item)
    return citations

