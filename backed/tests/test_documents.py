import os

from fastapi.testclient import TestClient

from app.main import create_app


def test_upload_txt_and_tree(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    app = create_app()
    client = TestClient(app)

    content = b"1 Intro\nHello world.\n\n1.1 Detail\nMore text."
    response = client.post(
        "/api/documents/upload",
        files={"file": ("sample.txt", content, "text/plain")},
    )
    assert response.status_code == 200
    payload = response.json()
    assert "document" in payload
    doc_id = payload["document"]["doc_id"]

    tree_response = client.get(f"/api/documents/{doc_id}/tree")
    assert tree_response.status_code == 200
    tree_payload = tree_response.json()
    assert tree_payload["doc_id"] == doc_id
    assert tree_payload["tree"]


def test_upload_rejects_unknown_extension(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    app = create_app()
    client = TestClient(app)

    response = client.post(
        "/api/documents/upload",
        files={"file": ("sample.bin", b"abc", "application/octet-stream")},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "unsupported file type"


def test_archive_restore_and_delete(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    app = create_app()
    client = TestClient(app)

    content = b"1 Intro\nHello world.\n\n1.1 Detail\nMore text."
    response = client.post(
        "/api/documents/upload",
        files={"file": ("sample.txt", content, "text/plain")},
    )
    assert response.status_code == 200
    doc_id = response.json()["document"]["doc_id"]

    archive_resp = client.post(
        f"/api/documents/{doc_id}/archive",
        json={"archive_path": "folder/sub"},
    )
    assert archive_resp.status_code == 200
    assert archive_resp.json()["document"]["status"] == "ARCHIVED"
    assert archive_resp.json()["document"]["meta"]["archive_path"] == "folder/sub"

    update_resp = client.post(
        f"/api/documents/{doc_id}/archive",
        json={"archive_path": "folder/next"},
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["document"]["status"] == "ARCHIVED"
    assert update_resp.json()["document"]["meta"]["archive_path"] == "folder/next"

    restore_resp = client.post(f"/api/documents/{doc_id}/restore")
    assert restore_resp.status_code == 200
    assert restore_resp.json()["document"]["status"] != "ARCHIVED"

    delete_resp = client.delete(f"/api/documents/{doc_id}")
    assert delete_resp.status_code == 200
    assert delete_resp.json()["deleted"] is True

    missing_resp = client.get(f"/api/documents/{doc_id}")
    assert missing_resp.status_code == 404
