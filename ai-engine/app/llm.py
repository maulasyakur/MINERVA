"""Thin wrapper around the OpenAI SDK. Works with OpenAI or any OpenAI-compatible server (vLLM on RunPod)."""
from functools import lru_cache

from openai import (APIConnectionError, APITimeoutError, AuthenticationError, OpenAI,
                    RateLimitError)

from .config import DEFAULT_BASE_URL, settings


class LLMError(RuntimeError):
    """Raised when the model is not configured or the request fails. Never includes secrets.

    code is one of: not_configured, rate_limited, timeout, auth, unreachable, upstream.
    """

    def __init__(self, message: str, code: str = "upstream"):
        super().__init__(message)
        self.code = code


@lru_cache(maxsize=1)
def _client() -> OpenAI:
    if not settings.api_key and settings.base_url == DEFAULT_BASE_URL:
        raise LLMError("OPENAI_API_KEY is not set", code="not_configured")
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
    except RateLimitError as exc:
        raise LLMError(f"rate limited: {type(exc).__name__}", code="rate_limited") from exc
    except APITimeoutError as exc:
        raise LLMError(f"timeout: {type(exc).__name__}", code="timeout") from exc
    except AuthenticationError as exc:
        raise LLMError(f"auth rejected: {type(exc).__name__}", code="auth") from exc
    except APIConnectionError as exc:
        raise LLMError(f"unreachable: {type(exc).__name__}", code="unreachable") from exc
    except Exception as exc:  # bad model name, malformed response, other upstream errors
        raise LLMError(f"model request failed: {type(exc).__name__}", code="upstream") from exc
    return (resp.choices[0].message.content or "").strip()
