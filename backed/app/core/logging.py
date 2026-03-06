from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict

from .request_id import get_request_id

STANDARD_ATTRS = {
    "name",
    "msg",
    "args",
    "levelname",
    "levelno",
    "pathname",
    "filename",
    "module",
    "exc_info",
    "exc_text",
    "stack_info",
    "lineno",
    "funcName",
    "created",
    "msecs",
    "relativeCreated",
    "thread",
    "threadName",
    "processName",
    "process",
    "message",
    "asctime",
    "request_id",
}


class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = get_request_id()
        return True


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "message": record.getMessage(),
            "logger": record.name,
            "request_id": getattr(record, "request_id", ""),
        }

        extra = {
            key: value
            for key, value in record.__dict__.items()
            if key not in STANDARD_ATTRS
        }
        if extra:
            payload.update(extra)

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)

        return json.dumps(payload, ensure_ascii=True, default=str)


def parse_log_level(value: str) -> int:
    level = value.upper()
    return logging._nameToLevel.get(level, logging.INFO)


def setup_logging(settings: Any) -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    handler.addFilter(RequestIdFilter())
    logging.basicConfig(
        level=parse_log_level(getattr(settings, "log_level", "INFO")),
        handlers=[handler],
        force=True,
    )
