from fastapi.testclient import TestClient

from app.main import create_app


def test_build_index_and_rollback(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    app = create_app()
    service = app.state.document_service

    content = b"1 Intro\nHello world.\n\n1.1 Detail\nMore text."
    doc = service.create_document("sample.txt", content)
    service.process_document(doc.doc_id)

    index_service = app.state.index_service
    meta_v1 = index_service.build_index()
    assert meta_v1.version == 1
    assert meta_v1.status.value == "READY"

    meta_v2 = index_service.build_index()
    assert meta_v2.version == 2

    rolled = index_service.rollback(1)
    assert rolled is not None
    assert rolled.version == 1

    client = TestClient(app)
    response = client.get("/ready")
    assert response.status_code == 200
    payload = response.json()
    assert payload["index_status"]["version"] == 1
