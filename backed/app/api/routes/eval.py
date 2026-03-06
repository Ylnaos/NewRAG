from __future__ import annotations

from pathlib import Path
import uuid
from fastapi import APIRouter, HTTPException, Request

from app.api.schemas import EvalRunRequest
from app.eval.service import build_dataset, run_evaluation_dataset


router = APIRouter(prefix="/api/eval", tags=["eval"])


@router.post("/run")
async def run_eval(request: Request, payload: EvalRunRequest) -> dict:
    dataset = build_dataset(_dump_model(payload))
    if not dataset.samples:
        raise HTTPException(status_code=400, detail="samples required")
    settings = request.app.state.settings
    report_id = str(uuid.uuid4())
    base_dir = Path(settings.data_dir)
    run_dir = base_dir / "eval" / "runs" / report_id
    report = run_evaluation_dataset(dataset, str(run_dir), settings=settings)
    request.app.state.eval_store.save(report_id, report)
    return {"report_id": report_id, "summary": report.get("summary", {})}


@router.get("/report/{report_id}")
async def get_report(report_id: str, request: Request) -> dict:
    report = request.app.state.eval_store.load(report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="report not found")
    return report


@router.get("/reports")
async def list_reports(request: Request) -> dict:
    reports = request.app.state.eval_store.list_reports()
    return {"reports": reports}


def _dump_model(model) -> dict:
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()
