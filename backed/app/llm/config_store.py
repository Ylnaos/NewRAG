from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _parse_bool(value: object) -> bool:
    if value is None:
        return False
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    return str(value).strip().lower() in {"1", "true", "yes", "y", "on"}


@dataclass
class LLMConfig:
    base_url: str = ""
    model_id: str = ""
    mode: str = "mock"
    enable_web_search: bool = False
    enable_thinking: bool = False
    updated_at: datetime = field(default_factory=_utcnow)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "base_url": self.base_url,
            "model_id": self.model_id,
            "mode": self.mode,
            "enable_web_search": self.enable_web_search,
            "enable_thinking": self.enable_thinking,
            "updated_at": self.updated_at.isoformat(),
        }

    @classmethod
    def from_dict(cls, payload: Dict[str, object]) -> "LLMConfig":
        return cls(
            base_url=str(payload.get("base_url", "")),
            model_id=str(payload.get("model_id", "")),
            mode=str(payload.get("mode", "mock")),
            enable_web_search=_parse_bool(payload.get("enable_web_search", False)),
            enable_thinking=_parse_bool(payload.get("enable_thinking", False)),
            updated_at=_parse_dt(payload.get("updated_at")),
        )


def _parse_dt(value: object) -> datetime:
    if not value:
        return _utcnow()
    try:
        return datetime.fromisoformat(str(value))
    except ValueError:
        return _utcnow()


class LLMConfigStore:
    def __init__(self, base_dir: str) -> None:
        self._base_dir = Path(base_dir) / "llm"
        self._base_dir.mkdir(parents=True, exist_ok=True)
        self._path = self._base_dir / "config.json"
        self._api_key_path = self._base_dir / "api_key.txt"

    def is_configured(self) -> bool:
        return self._path.exists()

    def load(self) -> LLMConfig:
        if not self._path.exists():
            return LLMConfig()
        payload = json.loads(self._path.read_text(encoding="utf-8"))
        return LLMConfig.from_dict(payload or {})

    def save(self, config: LLMConfig) -> None:
        self._path.write_text(json.dumps(config.to_dict(), ensure_ascii=True), encoding="utf-8")

    def load_api_key(self) -> str:
        if not self._api_key_path.exists():
            return ""
        return self._api_key_path.read_text(encoding="utf-8").strip()

    def save_api_key(self, api_key: str) -> None:
        self._api_key_path.write_text(str(api_key or "").strip(), encoding="utf-8")
