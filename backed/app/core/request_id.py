from __future__ import annotations

import contextvars
from typing import Optional

request_id_context: contextvars.ContextVar[str] = contextvars.ContextVar(
    "request_id", default=""
)


def get_request_id() -> str:
    return request_id_context.get()


def set_request_id(value: str) -> contextvars.Token:
    return request_id_context.set(value)


def reset_request_id(token: contextvars.Token) -> None:
    request_id_context.reset(token)
