from app.llm.client import LLMGenerateResult
from app.main import create_app


def _prepare_app(tmp_path, monkeypatch, llm_mode: str, *, enable_web_search: bool = False) -> object:
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    monkeypatch.setenv("LLM_MODE", llm_mode)
    monkeypatch.setenv("LLM_ENABLE_WEB_SEARCH", str(enable_web_search).lower())
    app = create_app()
    service = app.state.document_service

    content = b"1 Intro\nHello world.\n\n1.1 Detail\nMore text about evidence."
    doc = service.create_document("sample.txt", content)
    service.process_document(doc.doc_id)

    app.state.index_service.build_index()
    return app


def test_qa_service_mock_answer(tmp_path, monkeypatch) -> None:
    app = _prepare_app(tmp_path, monkeypatch, "mock")
    qa_service = app.state.qa_service

    result = qa_service.answer("What is in detail?", top_k=2, rerank_k=4, max_evidence=2)
    assert result["answer"]
    assert result["verify_status"] == "PASS"
    assert result["citations"]


def test_qa_service_fallback_when_disabled(tmp_path, monkeypatch) -> None:
    app = _prepare_app(tmp_path, monkeypatch, "disabled")
    qa_service = app.state.qa_service

    result = qa_service.answer("What is in detail?", top_k=2, rerank_k=4, max_evidence=2)
    assert result["answer"]
    assert result["verify_status"] == "FALLBACK"
    assert result["fallback_reason"].startswith("llm_error")


def test_qa_service_falls_back_when_verification_fails_even_if_web_search_enabled(tmp_path, monkeypatch) -> None:
    app = _prepare_app(tmp_path, monkeypatch, "mock", enable_web_search=True)
    qa_service = app.state.qa_service

    call_state = {}

    def fake_generate_with_meta(prompt: str, *args, **kwargs) -> LLMGenerateResult:
        call_state["enable_web_search"] = kwargs.get("enable_web_search")
        return LLMGenerateResult(text="xylophone quantum zebra lemon rocket")

    app.state.llm_client.generate_with_meta = fake_generate_with_meta  # type: ignore[method-assign]

    result = qa_service.answer("What is in detail?", top_k=2, rerank_k=4, max_evidence=2)
    assert call_state.get("enable_web_search") is False
    assert result["verify_status"] == "FALLBACK"
    assert result["fallback_reason"] == "verification_failed"


def test_qa_service_allows_short_answer_when_supported_by_evidence(tmp_path, monkeypatch) -> None:
    app = _prepare_app(tmp_path, monkeypatch, "mock")
    qa_service = app.state.qa_service

    # A short answer (2 tokens) should not be forced into fallback when it is fully supported
    # by the retrieved evidence.
    def fake_generate_with_meta(prompt: str, *args, **kwargs) -> LLMGenerateResult:
        return LLMGenerateResult(text="Hello world.")

    app.state.llm_client.generate_with_meta = fake_generate_with_meta  # type: ignore[method-assign]

    result = qa_service.answer("intro", top_k=2, rerank_k=4, max_evidence=2)
    assert result["verify_status"] == "PASS"
    assert result["fallback_reason"] == ""
    assert "Hello world" in result["answer"]


def test_qa_service_uses_conversation_history_for_memory(tmp_path, monkeypatch) -> None:
    app = _prepare_app(tmp_path, monkeypatch, "mock")
    qa_service = app.state.qa_service
    captured = {}

    def fake_generate_with_meta(prompt: str, *args, **kwargs) -> LLMGenerateResult:
        captured["prompt"] = prompt
        return LLMGenerateResult(text='{"answer":"Your previous message was: my name is Alice."}')

    app.state.llm_client.generate_with_meta = fake_generate_with_meta  # type: ignore[method-assign]

    result = qa_service.answer(
        "What did I say previously?",
        top_k=2,
        rerank_k=4,
        max_evidence=2,
        history=[
            {"role": "user", "content": "my name is Alice"},
            {"role": "assistant", "content": "Okay, I will remember that."},
        ],
    )
    assert "Conversation history:" in captured["prompt"]
    assert "my name is Alice" in captured["prompt"]
    assert result["verify_status"] == "PASS"
    assert result["fallback_reason"] == ""
    assert any(item.get("doc_id") == "conversation-memory" for item in result["citations"])
