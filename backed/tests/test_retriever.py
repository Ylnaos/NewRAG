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
