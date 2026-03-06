from __future__ import annotations

import time
from fastapi import APIRouter, HTTPException, Request

from app.api.schemas import LLMConfigRequest
from app.llm.config_store import LLMConfig


router = APIRouter(prefix="/api/llm", tags=["llm"])


@router.get("/config")
async def get_config(request: Request) -> dict:
    store = request.app.state.llm_config_store
    config = store.load()
    return {"config": config.to_dict()}


@router.post("/config")
async def update_config(request: Request, payload: LLMConfigRequest) -> dict:
    store = request.app.state.llm_config_store
    current = store.load()
    mode = payload.mode or current.mode
    if mode not in {"mock", "disabled", "moonshot"}:
        raise HTTPException(status_code=400, detail="unsupported llm mode")
    updated = LLMConfig(
        base_url=payload.base_url or current.base_url,
        model_id=payload.model_id or current.model_id,
        mode=mode,
        enable_web_search=payload.enable_web_search
        if payload.enable_web_search is not None
        else current.enable_web_search,
        enable_thinking=payload.enable_thinking if payload.enable_thinking is not None else current.enable_thinking,
    )
    store.save(updated)
    llm_client = request.app.state.llm_client
    llm_client.base_url = updated.base_url
    llm_client.model_id = updated.model_id
    llm_client.mode = updated.mode
    llm_client.enable_web_search = updated.enable_web_search
    llm_client.enable_thinking = updated.enable_thinking
    if payload.api_key:
        llm_client.api_key = payload.api_key
        store.save_api_key(payload.api_key)
    return {"config": updated.to_dict()}


@router.get("/models")
async def list_models(request: Request) -> dict:
    llm_client = request.app.state.llm_client
    try:
        models = llm_client.list_models()
    except NotImplementedError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"llm_error:{type(exc).__name__}") from exc
    return {"models": models}


@router.post("/test")
async def test_connection(request: Request) -> dict:
    llm_client = request.app.state.llm_client
    mode = (llm_client.mode or "").strip().lower()
    start = time.perf_counter()
    try:
        text = llm_client.generate("ping", temperature=0.0, max_tokens=8)
    except NotImplementedError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        latency_ms = int((time.perf_counter() - start) * 1000)
        status = "disabled" if mode == "disabled" else "error"
        return {
            "status": status,
            "mode": mode or "unknown",
            "latency_ms": latency_ms,
            "detail": str(exc),
        }
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"llm_error:{type(exc).__name__}") from exc
    latency_ms = int((time.perf_counter() - start) * 1000)
    if mode == "mock":
        return {
            "status": "mock",
            "mode": mode,
            "latency_ms": latency_ms,
            "sample": text,
            "detail": "LLM is running in mock mode; no external request was made.",
        }
    return {"status": "ok", "mode": mode or "unknown", "latency_ms": latency_ms, "sample": text}
