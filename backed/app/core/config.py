from __future__ import annotations

from dataclasses import dataclass
import logging
import os
from typing import List

from .version import APP_NAME, APP_VERSION


def _get_env(name: str, default: str) -> str:
    value = os.getenv(name)
    if value is None or value == "":
        return default
    return value


def _get_int_env(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None or value == "":
        return default
    try:
        return int(value)
    except ValueError as exc:
        raise ValueError(f"Invalid int for {name}: {value}") from exc


def _get_bool_env(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None or value == "":
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


@dataclass(frozen=True)
class Settings:
    app_name: str = APP_NAME
    app_version: str = APP_VERSION
    env: str = "dev"
    log_level: str = "INFO"
    request_id_header: str = "X-Request-ID"
    max_task_retries: int = 2
    task_timeout_seconds: int = 60
    data_dir: str = "data"
    max_upload_mb: int = 20
    chunk_size: int = 500
    chunk_overlap: int = 50
    vector_dim: int = 128
    llm_base_url: str = ""
    llm_model_id: str = ""
    llm_api_key: str = ""
    llm_mode: str = "mock"
    llm_enable_web_search: bool = False
    llm_enable_thinking: bool = False
    cors_allow_origins: str = ""

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            app_name=_get_env("APP_NAME", APP_NAME),
            app_version=_get_env("APP_VERSION", APP_VERSION),
            env=_get_env("APP_ENV", "dev"),
            log_level=_get_env("LOG_LEVEL", "INFO").upper(),
            request_id_header=_get_env("REQUEST_ID_HEADER", "X-Request-ID"),    
            max_task_retries=_get_int_env("MAX_TASK_RETRIES", 2),
            task_timeout_seconds=_get_int_env("TASK_TIMEOUT_SECONDS", 60),      
            data_dir=_get_env("DATA_DIR", "data"),
            max_upload_mb=_get_int_env("MAX_UPLOAD_MB", 20),
            chunk_size=_get_int_env("CHUNK_SIZE", 500),
            chunk_overlap=_get_int_env("CHUNK_OVERLAP", 50),
            vector_dim=_get_int_env("VECTOR_DIM", 128),
            llm_base_url=_get_env("LLM_BASE_URL", ""),
            llm_model_id=_get_env("LLM_MODEL_ID", ""),
            llm_api_key=_get_env("LLM_API_KEY", ""),
            llm_mode=_get_env("LLM_MODE", "mock"),
            llm_enable_web_search=_get_bool_env("LLM_ENABLE_WEB_SEARCH", False),
            llm_enable_thinking=_get_bool_env("LLM_ENABLE_THINKING", False),
            cors_allow_origins=_get_env("CORS_ALLOW_ORIGINS", ""),
        )

    def validate(self) -> List[str]:
        errors: List[str] = []
        if self.env not in {"dev", "test", "prod"}:
            errors.append("APP_ENV must be one of: dev, test, prod")
        if self.log_level not in {"CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG"}:
            errors.append("LOG_LEVEL must be a valid logging level")
        if not self.request_id_header:
            errors.append("REQUEST_ID_HEADER must not be empty")
        if self.max_task_retries < 0:
            errors.append("MAX_TASK_RETRIES must be >= 0")
        if self.task_timeout_seconds <= 0:
            errors.append("TASK_TIMEOUT_SECONDS must be > 0")
        if not self.data_dir:
            errors.append("DATA_DIR must not be empty")
        if self.max_upload_mb <= 0:
            errors.append("MAX_UPLOAD_MB must be > 0")
        if self.chunk_size <= 0:
            errors.append("CHUNK_SIZE must be > 0")
        if self.chunk_overlap < 0:
            errors.append("CHUNK_OVERLAP must be >= 0")
        if self.chunk_overlap >= self.chunk_size:
            errors.append("CHUNK_OVERLAP must be smaller than CHUNK_SIZE")
        if self.vector_dim <= 0:
            errors.append("VECTOR_DIM must be > 0")
        if self.log_level not in logging._nameToLevel:
            errors.append("LOG_LEVEL is not recognized by logging")
        if self.llm_mode not in {"mock", "disabled", "moonshot"}:
            errors.append("LLM_MODE must be one of: mock, disabled, moonshot")
        return errors

    def safe_dict(self) -> dict:
        return {
            "app_name": self.app_name,
            "app_version": self.app_version,
            "env": self.env,
            "log_level": self.log_level,
            "request_id_header": self.request_id_header,
            "max_task_retries": self.max_task_retries,
            "task_timeout_seconds": self.task_timeout_seconds,
            "data_dir": self.data_dir,
            "max_upload_mb": self.max_upload_mb,
            "chunk_size": self.chunk_size,
            "chunk_overlap": self.chunk_overlap,
            "vector_dim": self.vector_dim,
            "llm_base_url": self.llm_base_url,
            "llm_model_id": self.llm_model_id,
            "llm_mode": self.llm_mode,
            "llm_enable_web_search": self.llm_enable_web_search,
            "llm_enable_thinking": self.llm_enable_thinking,
            "cors_allow_origins": self.cors_allow_origins,
        }
