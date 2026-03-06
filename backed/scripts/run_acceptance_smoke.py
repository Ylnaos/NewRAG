from __future__ import annotations

import json
from datetime import datetime, timezone

from fastapi.testclient import TestClient

from app.main import create_app


EXPECTED_BASE_URL = "https://api.siliconflow.cn/v1"
EXPECTED_MODEL_ID = "Pro/zai-org/GLM-4.7"
EXPECTED_MODE = "moonshot"


def _assert(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> int:
    client = TestClient(create_app())
    report: dict[str, object] = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "checks": [],
    }

    def record(name: str, ok: bool, detail: str) -> None:
        status = "PASS" if ok else "FAIL"
        print(f"[{status}] {name}: {detail}")
        checks = report["checks"]
        if isinstance(checks, list):
            checks.append({"name": name, "status": status, "detail": detail})

    try:
        config_resp = client.get("/api/llm/config")
        _assert(config_resp.status_code == 200, f"/api/llm/config status={config_resp.status_code}")
        config = config_resp.json().get("config", {})
        _assert(config.get("mode") == EXPECTED_MODE, f"mode={config.get('mode')}")
        _assert(config.get("base_url") == EXPECTED_BASE_URL, f"base_url={config.get('base_url')}")
        _assert(config.get("model_id") == EXPECTED_MODEL_ID, f"model_id={config.get('model_id')}")
        record("LLM config", True, "mode/base_url/model_id match expected SiliconFlow settings")

        models_resp = client.get("/api/llm/models")
        _assert(models_resp.status_code == 200, f"/api/llm/models status={models_resp.status_code}")
        models = models_resp.json().get("models", [])
        _assert(isinstance(models, list) and len(models) > 0, "models list is empty")
        first_model = models[0].get("id") if isinstance(models[0], dict) else "unknown"
        record("LLM models", True, f"model_count={len(models)} first={first_model}")

        test_resp = client.post("/api/llm/test")
        _assert(test_resp.status_code == 200, f"/api/llm/test status={test_resp.status_code}")
        test_payload = test_resp.json()
        _assert(test_payload.get("status") == "ok", f"status={test_payload.get('status')}")
        record("LLM connectivity", True, f"mode={test_payload.get('mode')} latency_ms={test_payload.get('latency_ms')}")

        upload_content = b"1 Intro\nThe launch code is ORANGE-UNICORN-42.\n\n1.1 Detail\nUse evidence only.\n"
        upload_resp = client.post(
            "/api/documents/upload",
            files={"file": ("acceptance-smoke.txt", upload_content, "text/plain")},
        )
        _assert(upload_resp.status_code == 200, f"/api/documents/upload status={upload_resp.status_code}")
        upload_payload = upload_resp.json()
        document = upload_payload.get("document") if isinstance(upload_payload, dict) else None
        doc_id = (
            document.get("doc_id")
            if isinstance(document, dict)
            else upload_payload.get("doc_id")
            if isinstance(upload_payload, dict)
            else None
        )
        _assert(isinstance(doc_id, str) and doc_id, "doc_id missing in upload response")
        record("Document upload", True, f"doc_id={doc_id}")

        build_resp = client.post("/api/index/build", json={"async_process": False})
        _assert(build_resp.status_code == 200, f"/api/index/build status={build_resp.status_code}")
        index = build_resp.json().get("index", {})
        _assert(index.get("status") == "READY", f"index_status={index.get('status')}")
        record("Index build", True, f"version={index.get('version')} status={index.get('status')}")

        qa_resp = client.post(
            "/api/qa/query",
            json={"query": "What is the launch code?", "top_k": 3, "rerank_k": 10, "max_evidence": 3},
        )
        _assert(qa_resp.status_code == 200, f"/api/qa/query status={qa_resp.status_code}")
        qa_payload = qa_resp.json()
        answer = str(qa_payload.get("answer") or "")
        evidence = qa_payload.get("evidence") or []
        graph = qa_payload.get("graph") or {}
        _assert(answer.strip() != "", "answer is empty")
        _assert(isinstance(evidence, list) and len(evidence) > 0, "evidence list is empty")
        _assert(isinstance(graph.get("nodes"), list) and len(graph.get("nodes")) > 0, "graph.nodes is empty")
        answer_id = qa_payload.get("answer_id")
        _assert(isinstance(answer_id, str) and answer_id, "answer_id missing")
        record(
            "QA response format",
            True,
            f"answer_id={answer_id} verify_status={qa_payload.get('verify_status')} evidence={len(evidence)} graph_nodes={len(graph.get('nodes'))}",
        )

        graph_resp = client.get(f"/api/answers/{answer_id}/graph")
        _assert(graph_resp.status_code == 200, f"/api/answers/{{id}}/graph status={graph_resp.status_code}")
        graph_payload = graph_resp.json().get("graph", {})
        _assert(isinstance(graph_payload.get("nodes"), list), "graph endpoint payload missing nodes")
        record("Answer graph endpoint", True, f"nodes={len(graph_payload.get('nodes') or [])}")

        report["result"] = "PASS"
        print(json.dumps(report, ensure_ascii=False))
        return 0
    except Exception as exc:  # noqa: BLE001
        report["result"] = "FAIL"
        report["error"] = f"{type(exc).__name__}: {exc}"
        print(json.dumps(report, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
