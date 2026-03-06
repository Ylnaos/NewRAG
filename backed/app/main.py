from __future__ import annotations

from datetime import datetime, timezone
import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.answers.store import AnswerStore
from app.api.routes.answers import router as answers_router
from app.api.routes.documents import router as documents_router
from app.api.routes.eval import router as eval_router
from app.api.routes.feedback import router as feedback_router
from app.api.routes.health import router as health_router
from app.api.routes.index import router as index_router
from app.api.routes.llm import router as llm_router
from app.api.routes.qa import router as qa_router
from app.api.routes.tasks import router as tasks_router
from app.core.config import Settings
from app.core.logging import setup_logging
from app.core.middleware import RequestIdMiddleware
from app.core.task_queue import TaskQueue
from app.core.weights_store import ModelWeightsStore
from app.documents.service import DocumentService
from app.documents.store import DocumentStore
from app.evidence.service import EvidenceFusionService
from app.eval.store import EvalStore
from app.feedback.service import FeedbackService
from app.feedback.store import FeedbackStore
from app.index.service import IndexService
from app.index.store import IndexStore
from app.llm.client import LLMClient
from app.llm.config_store import LLMConfigStore
from app.qa.service import QAService
from app.retriever.service import RetrieverService
from app.verify.service import AnswerVerifier


def create_app() -> FastAPI:
    settings = Settings.from_env()
    setup_logging(settings)

    app = FastAPI(title=settings.app_name, version=settings.app_version)        
    origins = [item.strip() for item in settings.cors_allow_origins.split(",") if item.strip()]
    if not origins:
        origins = ["http://127.0.0.1:5173", "http://localhost:5173"]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.state.settings = settings
    app.state.task_queue = TaskQueue(
        max_retries=settings.max_task_retries,
        timeout_seconds=settings.task_timeout_seconds,
    )
    data_dir = Path(settings.data_dir)
    store = DocumentStore(str(data_dir))
    weights_store = ModelWeightsStore(str(data_dir))
    weights = weights_store.load()

    app.state.document_store = store
    app.state.document_service = DocumentService(
        store=store,
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
    )
    index_store = IndexStore(str(data_dir))
    app.state.index_service = IndexService(
        store=index_store,
        document_store=store,
        vector_dim=settings.vector_dim,
    )
    app.state.retriever_service = RetrieverService(app.state.index_service, weights=weights.retrieval)
    app.state.evidence_service = EvidenceFusionService(weights=weights.evidence)
    app.state.llm_client = LLMClient(
        mode=settings.llm_mode,
        base_url=settings.llm_base_url,
        api_key=settings.llm_api_key,
        model_id=settings.llm_model_id,
        enable_web_search=settings.llm_enable_web_search,
        enable_thinking=settings.llm_enable_thinking,
    )
    app.state.answer_verifier = AnswerVerifier()
    app.state.qa_service = QAService(
        retriever=app.state.retriever_service,
        evidence_fusion=app.state.evidence_service,
        llm_client=app.state.llm_client,
        verifier=app.state.answer_verifier,
    )
    app.state.feedback_service = FeedbackService(
        store=FeedbackStore(str(data_dir)),
    )
    app.state.model_weights_store = weights_store
    llm_config_store = LLMConfigStore(str(data_dir))
    app.state.llm_config_store = llm_config_store
    app.state.eval_store = EvalStore(str(data_dir))
    app.state.answer_store = AnswerStore(str(data_dir))
    app.state.started_at = datetime.now(timezone.utc)

    # Only override env/default LLM settings when an explicit persisted config exists.
    if llm_config_store.is_configured():
        llm_config = llm_config_store.load()
        if llm_config.base_url:
            app.state.llm_client.base_url = llm_config.base_url
        if llm_config.model_id:
            app.state.llm_client.model_id = llm_config.model_id
        if llm_config.mode:
            app.state.llm_client.mode = llm_config.mode
        app.state.llm_client.enable_web_search = llm_config.enable_web_search
        app.state.llm_client.enable_thinking = llm_config.enable_thinking

    if not app.state.llm_client.api_key:
        # Allow local/dev deployments to keep API keys out of tracked config files.
        app.state.llm_client.api_key = llm_config_store.load_api_key()

    app.add_middleware(RequestIdMiddleware, settings=settings)
    app.include_router(health_router)
    app.include_router(documents_router)
    app.include_router(qa_router)
    app.include_router(feedback_router)
    app.include_router(index_router)
    app.include_router(tasks_router)
    app.include_router(llm_router)
    app.include_router(eval_router)
    app.include_router(answers_router)

    logger = logging.getLogger("startup")

    @app.on_event("startup")
    async def on_startup() -> None:
        errors = settings.validate()
        if errors:
            logger.error("config_invalid", extra={"errors": errors})
        else:
            logger.info(
                "service_started",
                extra={"version": settings.app_version, "env": settings.env},
            )

    return app


app = create_app()
