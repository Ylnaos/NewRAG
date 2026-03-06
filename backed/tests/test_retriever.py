from dataclasses import replace
from datetime import datetime, timezone

from app.main import create_app


def test_retriever_returns_candidates(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    app = create_app()
    service = app.state.document_service

    content = b"1 Intro\nHello world.\n\n1.1 Detail\nMore text about retrieval."
    doc = service.create_document("sample.txt", content)
    service.process_document(doc.doc_id)

    index_service = app.state.index_service
    index_service.build_index()

    retriever = app.state.retriever_service
    result = retriever.retrieve("retrieval detail", top_k=2, rerank_k=4)

    assert "coarse_sections" in result
    assert "fine_chunks" in result
    assert result["coarse_sections"]
    assert result["fine_chunks"]


def test_retriever_prefers_recent_anchor_match(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    app = create_app()
    service = app.state.document_service
    store = app.state.document_store

    old_doc = service.create_document(
        "old.txt",
        b"1 Intro\nLegacy smoke note. Launch code is 271828.",
        title="old smoke",
        source="old.txt",
    )
    service.process_document(old_doc.doc_id)
    stored_old = store.load_document(old_doc.doc_id)
    assert stored_old is not None
    older_time = datetime(2025, 1, 1, tzinfo=timezone.utc)
    store.save_document(replace(stored_old, created_at=older_time, updated_at=older_time))

    new_doc = service.create_document(
        "smoke_notes.txt",
        b"1 Intro\nSMOKE-UUID: 20260305-aaaa-bbbb-cccc-smoke0001\nLaunch code: ORANGE-UNICORN-42",
        title="smoke_notes.txt",
        source="smoke_notes.txt",
    )
    service.process_document(new_doc.doc_id)

    app.state.index_service.build_index()
    result = app.state.retriever_service.retrieve("What is the SMOKE-UUID? Reply with the exact UUID only.", top_k=1, rerank_k=5)
    top = result["fine_chunks"][0]
    assert top["doc_id"] == new_doc.doc_id
    assert "20260305" in top["text"]
