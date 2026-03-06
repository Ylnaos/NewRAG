from __future__ import annotations

import re
from typing import List

_TOKEN_RE = re.compile(r"[A-Za-z0-9]+")


def tokenize(text: str) -> List[str]:
    tokens: List[str] = []
    buffer: List[str] = []

    def flush() -> None:
        if buffer:
            tokens.append("".join(buffer).lower())
            buffer.clear()

    for ch in text:
        if ch.isalnum():
            buffer.append(ch)
            continue
        flush()
        if _is_cjk(ch):
            tokens.append(ch)

    flush()
    return [token for token in tokens if token]


def _is_cjk(ch: str) -> bool:
    code = ord(ch)
    return (
        0x4E00 <= code <= 0x9FFF
        or 0x3400 <= code <= 0x4DBF
        or 0x20000 <= code <= 0x2A6DF
        or 0x2A700 <= code <= 0x2B73F
        or 0x2B740 <= code <= 0x2B81F
        or 0x2B820 <= code <= 0x2CEAF
        or 0xF900 <= code <= 0xFAFF
        or 0x2F800 <= code <= 0x2FA1F
    )
