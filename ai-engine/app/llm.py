"""Thin wrapper around the OpenAI SDK. Works with OpenAI or any OpenAI-compatible server (vLLM on RunPod)."""
from functools import lru_cache

from openai import OpenAI

from .config import DEFAULT_BASE_URL, settings


class LLMError(RuntimeError):
    """Raised when the model is not configured or the request fails. Never includes secrets."""


@lru_cache(maxsize=1)
def _client() -> OpenAI:
    if not settings.api_key and settings.base_url == DEFAULT_BASE_URL:
        raise LLMError("OPENAI_API_KEY is not set")
    return OpenAI(
        api_key=settings.api_key or "EMPTY",  # vLLM without --api-key accepts any value
        base_url=settings.base_url,
        timeout=60.0,
        max_retries=2,
    )


def chat(system: str, user: str, max_tokens: int = 700) -> str:
    kwargs: dict = {
        "model": settings.model,
        "max_completion_tokens": max_tokens,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }
    if settings.reasoning_effort:
        # Reasoning models: send the effort level (default "none" = reasoning off).
        # Temperature is left out because reasoning models reject custom values.
        kwargs["reasoning_effort"] = settings.reasoning_effort
    else:
        kwargs["temperature"] = 0.3
    try:
        resp = _client().chat.completions.create(**kwargs)
    except LLMError:
        raise
    except Exception as exc:  # network, auth, rate limit, bad model name
        raise LLMError(f"model request failed: {type(exc).__name__}") from exc
    return (resp.choices[0].message.content or "").strip()
