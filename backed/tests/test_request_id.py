from fastapi.testclient import TestClient

from app.main import create_app


def test_request_id_passthrough() -> None:
    app = create_app()
    client = TestClient(app)
    response = client.get("/health", headers={"X-Request-ID": "req-123"})
    assert response.status_code == 200
    assert response.headers.get("X-Request-ID") == "req-123"


def test_request_id_auto_generated() -> None:
    app = create_app()
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert "X-Request-ID" in response.headers
