from fastapi.testclient import TestClient

from app.llm.client import LLMGenerateResult
from app.main import create_app


def _prepare_app(tmp_path, monkeypatch) -> TestClient:
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    monkeypatch.setenv("LLM_MODE", "mock")
    app = create_app()
    service = app.state.document_service

    content = b"1 Intro\nHello world.\n\n1.1 Detail\nMore text about evidence."
    doc = service.create_document("sample.txt", content)
    service.process_document(doc.doc_id)
    return TestClient(app)


def test_index_and_qa_endpoint(tmp_path, monkeypatch) -> None:
    client = _prepare_app(tmp_path, monkeypatch)

    build_resp = client.post("/api/index/build", json={"async_process": False})
    assert build_resp.status_code == 200
    assert build_resp.json()["index"]["status"] == "READY"

    qa_resp = client.post(
        "/api/qa/query",
        json={
            "query": "detail",
            "top_k": 2,
            "rerank_k": 4,
            "max_evidence": 2,
            "history": [{"role": "user", "content": "请基于上下文回答。"}],
        },
    )
    assert qa_resp.status_code == 200
    payload = qa_resp.json()
    assert payload["answer"]
    assert payload["evidence"]
    assert payload["graph"]["nodes"]
    answer_id = payload["answer_id"]
    graph_resp = client.get(f"/api/answers/{answer_id}/graph")
    assert graph_resp.status_code == 200
    evidence_resp = client.get(f"/api/answers/{answer_id}/evidence")
    assert evidence_resp.status_code == 200


def test_feedback_endpoint(tmp_path, monkeypatch) -> None:
    client = _prepare_app(tmp_path, monkeypatch)

    resp = client.post(
        "/api/feedback",
        json={"node_id": "chunk-1", "score": 4, "comment": "useful"},
    )
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["feedback"]["node_id"] == "chunk-1"
    assert payload["feedback"]["score"] == 4


def test_qa_graph_fallback_when_llm_omits_graph(tmp_path, monkeypatch) -> None:
    client = _prepare_app(tmp_path, monkeypatch)
    build_resp = client.post("/api/index/build", json={"async_process": False})
    assert build_resp.status_code == 200

    def fake_generate_with_meta(*args, **kwargs) -> LLMGenerateResult:  # noqa: ANN002, ANN003
        return LLMGenerateResult(text='{"answer":"More text about evidence."}')

    client.app.state.llm_client.generate_with_meta = fake_generate_with_meta  # type: ignore[method-assign]
    qa_resp = client.post(
        "/api/qa/query",
        json={"query": "detail", "top_k": 2, "rerank_k": 4, "max_evidence": 2},
    )
    assert qa_resp.status_code == 200
    payload = qa_resp.json()
    graph = payload["graph"]
    assert len(graph["nodes"]) >= 1
    first_meta = graph["nodes"][0]["metadata"]
    for key in ("dbName", "fileName", "reason", "page", "relevance", "nodeInfo", "snippet"):
        assert key in first_meta


def test_task_queue_and_llm_config(tmp_path, monkeypatch) -> None:
    client = _prepare_app(tmp_path, monkeypatch)

    build_resp = client.post("/api/index/build", json={"async_process": True})
    assert build_resp.status_code == 200
    task_id = build_resp.json()["task_id"]

    task_resp = client.get(f"/api/tasks/{task_id}")
    assert task_resp.status_code == 200
    assert task_resp.json()["task"]["task_id"] == task_id

    config_resp = client.post(
        "/api/llm/config",
        json={"base_url": "http://example", "model_id": "mock-1", "mode": "mock"},
    )
    assert config_resp.status_code == 200
    get_resp = client.get("/api/llm/config")
    assert get_resp.status_code == 200
    assert get_resp.json()["config"]["model_id"] == "mock-1"

    models_resp = client.get("/api/llm/models")
    assert models_resp.status_code == 200
    assert "models" in models_resp.json()

    test_resp = client.post("/api/llm/test")
    assert test_resp.status_code == 200
    assert test_resp.json()["status"] == "mock"
    assert test_resp.json()["mode"] == "mock"


def test_eval_run_and_report(tmp_path, monkeypatch) -> None:
    client = _prepare_app(tmp_path, monkeypatch)
    payload = {
        "documents": [
            {
                "filename": "sample.txt",
                "content": "1 Intro\nHello world.\n\n1.1 Detail\nMore text.",
                "title": "Sample",
                "source": "sample.txt",
            }
        ],
        "samples": [
            {
                "sample_id": "s1",
                "query": "detail",
                "expected_evidence": ["More text"],
                "top_k": 2,
                "rerank_k": 4,
                "max_evidence": 2,
            }
        ],
    }
    run_resp = client.post("/api/eval/run", json=payload)
    assert run_resp.status_code == 200
    report_id = run_resp.json()["report_id"]
    report_resp = client.get(f"/api/eval/report/{report_id}")
    assert report_resp.status_code == 200
