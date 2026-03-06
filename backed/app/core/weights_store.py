from __future__ import annotations

import json
from pathlib import Path

from .weights import ModelWeights


class ModelWeightsStore:
    def __init__(self, base_dir: str) -> None:
        self._base_dir = Path(base_dir) / "model"
        self._base_dir.mkdir(parents=True, exist_ok=True)
        self._path = self._base_dir / "weights.json"

    def load(self) -> ModelWeights:
        if not self._path.exists():
            return ModelWeights()
        payload = json.loads(self._path.read_text(encoding="utf-8"))
        return ModelWeights.from_dict(payload or {})

    def save(self, weights: ModelWeights) -> None:
        self._path.write_text(json.dumps(weights.to_dict(), ensure_ascii=True), encoding="utf-8")
