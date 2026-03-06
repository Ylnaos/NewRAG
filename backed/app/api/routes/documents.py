from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile

from app.api.schemas import ArchiveDocumentRequest

router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.post("/upload")
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    source: Optional[str] = Form(None),
    async_process: bool = Form(False),
) -> dict:
    if file.filename is None:
        raise HTTPException(status_code=400, detail="missing filename")

    content = await file.read()
    service = request.app.state.document_service
    settings = request.app.state.settings
    try:
        doc = service.create_document(
            filename=file.filename,
            content=content,
            title=title,
            source=source,
            meta={"content_type": file.content_type},
            max_upload_mb=settings.max_upload_mb,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    request.app.state.index_service.mark_stale()
    if async_process:
        service.mark_queued(doc.doc_id)
        task_id = await request.app.state.task_queue.submit(service.process_document, doc.doc_id)
        return {
            "doc_id": doc.doc_id,
            "status": "QUEUED",
            "task_id": task_id,
        }

    service.process_document(doc.doc_id)
    summary = service.get_document(doc.doc_id)
    return summary or {"doc_id": doc.doc_id, "status": doc.status.value}


@router.get("")
async def list_documents(request: Request) -> dict:
    service = request.app.state.document_service
    docs = [doc.to_dict() for doc in service.list_documents()]
    return {"documents": docs}


@router.get("/{doc_id}")
async def get_document(doc_id: str, request: Request) -> dict:
    service = request.app.state.document_service
    detail = service.get_document(doc_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="document not found")
    return detail


@router.get("/{doc_id}/tree")
async def get_document_tree(doc_id: str, request: Request) -> dict:
    service = request.app.state.document_service
    detail = service.get_document(doc_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="document not found")
    tree = service.get_tree(doc_id)
    if tree is None:
        raise HTTPException(status_code=409, detail="document not processed")
    return {"doc_id": doc_id, "tree": tree}


@router.delete("/{doc_id}")
async def delete_document(doc_id: str, request: Request) -> dict:
    service = request.app.state.document_service
    deleted = service.delete_document(doc_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="document not found")
    request.app.state.index_service.mark_stale()
    return {"doc_id": doc_id, "deleted": True}


@router.post("/{doc_id}/archive")
async def archive_document(
    doc_id: str,
    request: Request,
    payload: Optional[ArchiveDocumentRequest] = None,
) -> dict:
    service = request.app.state.document_service
    try:
        updated = service.archive_document(
            doc_id,
            restore=False,
            archive_path=payload.archive_path if payload else None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if updated is None:
        raise HTTPException(status_code=404, detail="document not found")
    request.app.state.index_service.mark_stale()
    return {"document": updated.to_dict()}


@router.post("/{doc_id}/restore")
async def restore_document(doc_id: str, request: Request) -> dict:
    service = request.app.state.document_service
    updated = service.archive_document(doc_id, restore=True)
    if updated is None:
        raise HTTPException(status_code=404, detail="document not found")
    request.app.state.index_service.mark_stale()
    return {"document": updated.to_dict()}