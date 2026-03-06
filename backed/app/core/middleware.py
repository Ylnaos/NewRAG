from __future__ import annotations

import logging
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from .request_id import reset_request_id, set_request_id


class RequestIdMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, settings) -> None:
        super().__init__(app)
        self._header_name = settings.request_id_header
        self._logger = logging.getLogger("http")

    async def dispatch(self, request: Request, call_next):
        inbound = request.headers.get(self._header_name)
        request_id = inbound or str(uuid.uuid4())
        token = set_request_id(request_id)
        start = time.perf_counter()
        response = None
        try:
            response = await call_next(request)
            response.headers[self._header_name] = request_id
            return response
        except Exception:  # noqa: BLE001
            self._logger.exception(
                "request_failed",
                extra={"method": request.method, "path": request.url.path},
            )
            raise
        finally:
            duration_ms = int((time.perf_counter() - start) * 1000)
            status_code = response.status_code if response else 500
            self._logger.info(
                "request_complete",
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": status_code,
                    "duration_ms": duration_ms,
                },
            )
            reset_request_id(token)
