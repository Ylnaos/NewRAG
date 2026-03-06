from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import httpx


# SiliconFlow models can occasionally take longer than 60s under load.
# Keep a conservative default to reduce avoidable fallback responses.
DEFAULT_TIMEOUT_SECONDS = 120.0


class MoonshotError(RuntimeError):
    pass


@dataclass(frozen=True)
class MoonshotGenerateResult:
    text: str
    reasoning_content: Optional[str] = None


def _normalize_base_url(base_url: str) -> str:
    normalized = (base_url or "").strip().rstrip("/")
    if not normalized:
        raise MoonshotError("Moonshot base_url is empty")
    return normalized


def _headers(api_key: str) -> Dict[str, str]:
    key = (api_key or "").strip()
    if not key:
        raise MoonshotError("Moonshot api_key is empty")
    return {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


def list_models(
    base_url: str,
    api_key: str,
    *,
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
) -> List[Dict[str, Any]]:
    url = f"{_normalize_base_url(base_url)}/models"
    try:
        resp = httpx.get(url, headers=_headers(api_key), timeout=timeout_seconds)
        resp.raise_for_status()
        payload = resp.json()
    except httpx.HTTPStatusError as exc:
        raise MoonshotError(f"Moonshot models request failed: {exc.response.status_code}") from exc
    except (httpx.RequestError, json.JSONDecodeError) as exc:
        raise MoonshotError(f"Moonshot models request failed: {type(exc).__name__}") from exc

    data = payload.get("data")
    return data if isinstance(data, list) else []


def generate_chat_completion(
    base_url: str,
    api_key: str,
    *,
    model: str,
    user_prompt: str,
    temperature: float,
    max_tokens: int,
    enable_web_search: bool = False,
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
    max_tool_rounds: int = 8,
) -> MoonshotGenerateResult:
    normalized_base = _normalize_base_url(base_url)
    model = (model or "").strip()
    if not model:
        raise MoonshotError("Moonshot model is empty")

    # Kimi's builtin $web_search follows the normal tool_calls loop:
    # declare tools -> receive tool_calls -> append role=tool messages -> call again.
    tools: List[Dict[str, Any]] = []
    if enable_web_search:
        tools = [{"type": "builtin_function", "function": {"name": "$web_search"}}]

    messages: List[Dict[str, Any]] = [{"role": "user", "content": user_prompt}]
    reasoning_content: Optional[str] = None

    for _ in range(max(1, max_tool_rounds)):
        payload: Dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if tools:
            # Moonshot docs recommend sending tools declaration on every request.
            payload["tools"] = tools

        try:
            resp = httpx.post(
                f"{normalized_base}/chat/completions",
                headers=_headers(api_key),
                json=payload,
                timeout=timeout_seconds,
            )
            resp.raise_for_status()
            completion = resp.json()
        except httpx.HTTPStatusError as exc:
            raise MoonshotError(f"Moonshot chat request failed: {exc.response.status_code}") from exc
        except (httpx.RequestError, json.JSONDecodeError) as exc:
            raise MoonshotError(f"Moonshot chat request failed: {type(exc).__name__}") from exc

        choices = completion.get("choices") or []
        if not isinstance(choices, list) or not choices:
            raise MoonshotError("Moonshot chat response has no choices")

        choice = choices[0] if isinstance(choices[0], dict) else {}
        finish_reason = choice.get("finish_reason")
        message = choice.get("message") if isinstance(choice.get("message"), dict) else {}

        # For thinking models like `kimi-k2-thinking`, Moonshot may return `reasoning_content`.
        if reasoning_content is None and message.get("reasoning_content"):
            reasoning_content = str(message.get("reasoning_content"))

        if finish_reason != "tool_calls":
            return MoonshotGenerateResult(text=str(message.get("content") or ""), reasoning_content=reasoning_content)

        tool_calls = message.get("tool_calls") or []
        if not isinstance(tool_calls, list) or not tool_calls:
            raise MoonshotError("Moonshot finish_reason=tool_calls but tool_calls missing")

        # Keep assistant tool_calls message in the context.
        messages.append(message)

        for tool_call in tool_calls:
            if not isinstance(tool_call, dict):
                continue
            func = tool_call.get("function") if isinstance(tool_call.get("function"), dict) else {}
            tool_name = str(func.get("name") or "")
            args_text = func.get("arguments")

            arguments: Any
            if isinstance(args_text, str) and args_text.strip():
                try:
                    arguments = json.loads(args_text)
                except json.JSONDecodeError:
                    arguments = {"raw": args_text}
            else:
                arguments = {}

            if tool_name == "$web_search":
                # Per Moonshot docs, builtin_function.$web_search can be executed by returning
                # the arguments as the tool result (Moonshot executes the search server-side).
                tool_result = arguments
            else:
                tool_result = {"error": f"unsupported tool: {tool_name}"}

            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": str(tool_call.get("id") or ""),
                    "name": tool_name,
                    "content": json.dumps(tool_result, ensure_ascii=False),
                }
            )

    raise MoonshotError("Moonshot tool_calls exceeded max_tool_rounds")
