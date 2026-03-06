from __future__ import annotations

import re
from pathlib import Path
from typing import List, Optional, Tuple
import uuid

from PyPDF2 import PdfReader
from docx import Document as DocxDocument

from .models import Paragraph, Section


_HEADING_RE = re.compile(r"^(\d+(?:\.\d+)*)\s+(.+)$")
_MD_HEADING_RE = re.compile(r"^(#{1,6})\s+(.+)$")


class DocumentParser:
    def parse(self, doc_id: str, file_path: Path) -> Tuple[List[Section], List[Paragraph]]:
        suffix = file_path.suffix.lower()
        if suffix in {".md", ".markdown"}:
            text = self._read_text(file_path)
            return self._parse_markdown(doc_id, text)
        if suffix in {".txt"}:
            text = self._read_text(file_path)
            return self.parse_plain_text(doc_id, text)
        if suffix in {".docx"}:
            return self._parse_docx(doc_id, file_path)
        if suffix in {".pdf"}:
            return self._parse_pdf(doc_id, file_path)
        raise ValueError(f"unsupported file type: {suffix}")

    def _read_text(self, path: Path) -> str:
        raw = path.read_bytes()
        for encoding in ("utf-8", "utf-16", "gb18030"):
            try:
                return raw.decode(encoding)
            except UnicodeDecodeError:
                continue
        return raw.decode("utf-8", errors="ignore")

    def _parse_markdown(self, doc_id: str, text: str) -> Tuple[List[Section], List[Paragraph]]:
        lines = text.splitlines()
        return self._parse_lines(doc_id, lines, markdown=True)

    def _parse_plain_text(self, doc_id: str, text: str) -> Tuple[List[Section], List[Paragraph]]:
        lines = text.splitlines()
        return self._parse_lines(doc_id, lines, markdown=False)

    def parse_plain_text(self, doc_id: str, text: str) -> Tuple[List[Section], List[Paragraph]]:
        return self._parse_plain_text(doc_id, text)

    def _parse_docx(self, doc_id: str, path: Path) -> Tuple[List[Section], List[Paragraph]]:
        doc = DocxDocument(str(path))
        root = self._create_root(doc_id)
        sections = [root]
        paragraphs: List[Paragraph] = []
        stack = [root]
        para_order = 0
        section_order = 0

        for para in doc.paragraphs:
            text = para.text.strip()
            if not text:
                continue
            heading_level = _docx_heading_level(para.style.name)
            if heading_level is not None:
                section_order += 1
                new_section = self._new_section(
                    doc_id,
                    stack,
                    heading_level,
                    text,
                    section_order,
                )
                sections.append(new_section)
                continue

            current = stack[-1]
            para_order += 1
            paragraphs.append(
                Paragraph(
                    paragraph_id=str(uuid.uuid4()),
                    section_id=current.section_id,
                    text=text,
                    order=para_order,
                )
            )

        return sections, paragraphs

    def _parse_pdf(self, doc_id: str, path: Path) -> Tuple[List[Section], List[Paragraph]]:
        reader = PdfReader(str(path))
        lines: List[str] = []
        for page in reader.pages:
            text = page.extract_text() or ""
            lines.extend(text.splitlines())
        return self._parse_lines(doc_id, lines, markdown=False)

    def _parse_lines(
        self, doc_id: str, lines: List[str], markdown: bool
    ) -> Tuple[List[Section], List[Paragraph]]:
        root = self._create_root(doc_id)
        sections = [root]
        paragraphs: List[Paragraph] = []
        stack = [root]
        buffer: List[str] = []
        para_order = 0
        section_order = 0

        def flush() -> None:
            nonlocal para_order
            if not buffer:
                return
            text = "\n".join(buffer).strip()
            buffer.clear()
            if not text:
                return
            para_order += 1
            current = stack[-1]
            paragraphs.append(
                Paragraph(
                    paragraph_id=str(uuid.uuid4()),
                    section_id=current.section_id,
                    text=text,
                    order=para_order,
                )
            )

        for raw in lines:
            line = raw.rstrip()
            if not line:
                flush()
                continue
            if markdown:
                md_match = _MD_HEADING_RE.match(line)
                if md_match:
                    flush()
                    level = len(md_match.group(1))
                    title = md_match.group(2).strip()
                    section_order += 1
                    sections.append(
                        self._new_section(doc_id, stack, level, title, section_order)
                    )
                    continue
            heading = _HEADING_RE.match(line)
            if heading:
                flush()
                number = heading.group(1)
                title = heading.group(2).strip()
                level = number.count(".") + 1
                section_order += 1
                sections.append(
                    self._new_section(doc_id, stack, level, title, section_order)
                )
                continue
            buffer.append(line)

        flush()
        return sections, paragraphs

    def _create_root(self, doc_id: str) -> Section:
        return Section(
            section_id=str(uuid.uuid4()),
            doc_id=doc_id,
            level=0,
            title="root",
            path="root",
            parent_id=None,
            order=0,
        )

    def _new_section(
        self,
        doc_id: str,
        stack: List[Section],
        level: int,
        title: str,
        order: int,
    ) -> Section:
        while len(stack) - 1 >= level:
            stack.pop()
        parent = stack[-1]
        path = f"{parent.path} / {title}" if parent.path else title
        section = Section(
            section_id=str(uuid.uuid4()),
            doc_id=doc_id,
            level=level,
            title=title,
            path=path,
            parent_id=parent.section_id,
            order=order,
        )
        stack.append(section)
        return section


def _docx_heading_level(style_name: str) -> Optional[int]:
    if not style_name:
        return None
    name = style_name.lower()
    if name.startswith("heading"):
        digits = re.findall(r"\d+", name)
        if digits:
            return max(1, int(digits[0]))
        return 1
    if name == "title":
        return 1
    return None
