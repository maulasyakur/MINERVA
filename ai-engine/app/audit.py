"""Audit trail for model answers: what was asked, which prompt version, which runs were cited, and the answer.

One JSON line per answer, appended to AUDIT_LOG_PATH (default: ai-engine/data/audit.jsonl). Only answers that
were produced are recorded; failures are not. The prompt is stored in full, so keep this file private.
"""
import hashlib
import json
import os
import re
import time
from pathlib import Path

from .config import ENGINE_DIR

PROMPT_VERSION = "2026-11-15.1"  # bump when a system prompt or the prompt builder changes
AUDIT_PATH = Path(os.getenv("AUDIT_LOG_PATH", ENGINE_DIR / "data" / "audit.jsonl"))
_CITE = re.compile(r"row[_ ]index\D{0,3}(\d+)|\brow (\d+)\b", re.I)


def cited_rows(answer: str) -> list[int]:
    """Row numbers the answer mentions, e.g. 'row_index 5' or 'row 12'."""
    found = {int(a or b) for a, b in _CITE.findall(answer or "")}
    return sorted(found)


def record(kind: str, prompt: str, answer: str, model: str) -> None:
    entry = {
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "kind": kind,
        "prompt_version": PROMPT_VERSION,
        "model": model,
        "prompt_sha256": hashlib.sha256(prompt.encode("utf-8")).hexdigest(),
        "prompt": prompt,
        "answer": answer,
        "cited_rows": cited_rows(answer),
    }
    try:
        AUDIT_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(AUDIT_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except OSError as exc:
        # Never fail the user's request because the log is unavailable; say so in the server log.
        print(f"[ai-engine] audit write failed: {type(exc).__name__}")
