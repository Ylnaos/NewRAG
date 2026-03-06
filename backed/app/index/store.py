from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Optional

from .models import IndexMeta


class IndexStore:
    def __init__(self, base_dir: str) -> None:
        self._base_dir = Path(base_dir) / "index"
        self._meta_path = self._base_dir / "meta.json"
        self._ensure_dirs()

    def _ensure_dirs(self) -> None:
        self._base_dir.mkdir(parents=True, exist_ok=True)

    def load_meta(self) -> Dict[str, object]:
        if not self._meta_path.exists():
            return {"current": None, "history": []}
        payload = json.loads(self._meta_path.read_text(encoding="utf-8"))
        return payload

    def save_meta(self, payload: Dict[str, object]) -> None:
        self._meta_path.write_text(json.dumps(payload, ensure_ascii=True), encoding="utf-8")

    def next_version(self) -> int:
        payload = self.load_meta()
        history = payload.get("history", [])
        if not history:
            return 1
        return max(int(item.get("version", 0)) for item in history) + 1

    def save_index(
        self,
        meta: IndexMeta,
        bm25_data: Dict[str, object],
        vector_data: Dict[str, object],
        corpus: List[Dict[str, object]],
    ) -> None:
        bm25_path = self._base_dir / meta.bm25_path
        vector_path = self._base_dir / meta.vector_path
        corpus_path = self._base_dir / meta.corpus_path

        bm25_path.write_text(json.dumps(bm25_data, ensure_ascii=True), encoding="utf-8")
        vector_path.write_text(json.dumps(vector_data, ensure_ascii=True), encoding="utf-8")
        corpus_path.write_text(json.dumps(corpus, ensure_ascii=True), encoding="utf-8")

        payload = self.load_meta()
        history = payload.get("history", [])
        history.append(meta.to_dict())
        payload["history"] = history
        payload["current"] = meta.to_dict()
        self.save_meta(payload)

    def save_building(self, meta: IndexMeta) -> None:
        payload = self.load_meta()
        payload["current"] = meta.to_dict()
        self.save_meta(payload)

    def load_index_meta(self, version: Optional[int] = None) -> Optional[IndexMeta]:
        payload = self.load_meta()
        history = payload.get("history", [])
        if version is None:
            current = payload.get("current")
            if not current:
                return None
            return IndexMeta.from_dict(current)
        for item in history:
            if int(item.get("version", 0)) == version:
                return IndexMeta.from_dict(item)
        return None

    def set_current(self, version: int) -> Optional[IndexMeta]:
        payload = self.load_meta()
        history = payload.get("history", [])
        for item in history:
            if int(item.get("version", 0)) == version:
                payload["current"] = item
                self.save_meta(payload)
                return IndexMeta.from_dict(item)
        return None

    def load_data(self, meta: IndexMeta) -> Dict[str, object]:
        bm25_path = self._base_dir / meta.bm25_path
        vector_path = self._base_dir / meta.vector_path
        corpus_path = self._base_dir / meta.corpus_path
        return {
            "bm25": json.loads(bm25_path.read_text(encoding="utf-8")),
            "vector": json.loads(vector_path.read_text(encoding="utf-8")),
            "corpus": json.loads(corpus_path.read_text(encoding="utf-8")),
        }
