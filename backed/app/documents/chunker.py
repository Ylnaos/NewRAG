from __future__ import annotations

from typing import Dict, List
import uuid

from .models import Chunk, Paragraph, Section


def chunk_paragraphs(
    doc_id: str,
    sections: List[Section],
    paragraphs: List[Paragraph],
    chunk_size: int,
    chunk_overlap: int,
) -> List[Chunk]:
    section_map: Dict[str, Section] = {section.section_id: section for section in sections}
    grouped: Dict[str, List[Paragraph]] = {}
    for paragraph in paragraphs:
        grouped.setdefault(paragraph.section_id, []).append(paragraph)

    chunks: List[Chunk] = []
    order = 0

    for section_id, items in grouped.items():
        items.sort(key=lambda item: item.order)
        combined = "\n".join(item.text for item in items if item.text)
        if not combined:
            continue
        for part in _split_text(combined, chunk_size, chunk_overlap):
            order += 1
            section = section_map.get(section_id)
            path = section.path if section else ""
            chunks.append(
                Chunk(
                    chunk_id=str(uuid.uuid4()),
                    doc_id=doc_id,
                    section_id=section_id,
                    path=path,
                    text=part,
                    token_len=len(part),
                    order=order,
                )
            )

    return chunks


def _split_text(text: str, size: int, overlap: int) -> List[str]:
    if size <= 0:
        return []
    if overlap >= size:
        overlap = max(0, size - 1)
    parts: List[str] = []
    start = 0
    length = len(text)
    while start < length:
        end = min(start + size, length)
        cut = text[start:end]
        if end < length:
            trimmed = _trim_to_boundary(cut)
            if trimmed:
                end = start + len(trimmed)
                cut = trimmed
        parts.append(cut)
        if end == length:
            break
        start = max(0, end - overlap)
    return parts


def _trim_to_boundary(chunk: str) -> str:
    for separator in ["\n", ". ", "? ", "! ", " "]:
        idx = chunk.rfind(separator)
        if idx > 0:
            return chunk[: idx + len(separator)].rstrip()
    return chunk
