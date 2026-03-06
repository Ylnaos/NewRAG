from fastapi.testclient import TestClient

from app.main import create_app


def test_health_ok() -> None:
    app = create_app()
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert "version" in payload
    assert "time" in payload


def test_ready_ok(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    app = create_app()
    client = TestClient(app)
    response = client.get("/ready")
    assert response.status_code == 200
    payload = response.json()
    assert "ready" in payload
    assert "errors" in payload
    assert payload["index_freshness"] == "MISSING"
