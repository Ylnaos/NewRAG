from __future__ import annotations

from datetime import datetime, timezone
from fastapi import APIRouter, Request

router = APIRouter()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@router.get("/health")
async def health(request: Request) -> dict:
    settings = request.app.state.settings
    started_at = getattr(request.app.state, "started_at", None)
    now = _utcnow()
    uptime_seconds = None
    if started_at:
        uptime_seconds = int((now - started_at).total_seconds())
    return {
        "status": "ok",
        "version": settings.app_version,
        "time": now.isoformat(),
        "uptime_seconds": uptime_seconds,
    }


@router.get("/ready")
async def ready(request: Request) -> dict:
    settings = request.app.state.settings
    errors = settings.validate()
    index_meta = request.app.state.index_service.get_status()
    return {
        "ready": len(errors) == 0,
        "errors": errors,
        "version": settings.app_version,
        "index_status": index_meta.to_dict() if index_meta else None,
    }
