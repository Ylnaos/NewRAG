from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from .models import AnswerRecord


class AnswerStore:
    def __init__(self, base_dir: str) -> None:
        self._base_dir = Path(base_dir) / "answers"
        self._base_dir.mkdir(parents=True, exist_ok=True)

    def save(self, record: AnswerRecord) -> None:
        path = self._base_dir / f"{record.answer_id}.json"
        path.write_text(json.dumps(record.to_dict(), ensure_ascii=True), encoding="utf-8")

    def load(self, answer_id: str) -> Optional[AnswerRecord]:
        path = self._base_dir / f"{answer_id}.json"
        if not path.exists():
            return None
        payload = json.loads(path.read_text(encoding="utf-8"))
        return AnswerRecord.from_dict(payload)
