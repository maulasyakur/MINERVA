"""Label each run's observed outcome from its own notes and raw fields, using the model.

Only the text of that row is given to the model. It must answer "unknown" when the row does not say.
Output is a review file: a person must check labels before any model is trained on them.

Usage (from ai-engine/):
    python scripts/extract_outcomes.py --limit 10 --out ../dataset-psi/derived/outcomes_sample.csv
"""
import argparse
import csv
import json
import re
import sys
from pathlib import Path

import os  # noqa: E402

ENGINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ENGINE))

# The app reads environment variables only; load ai-engine/.env here for local runs (the file is git-ignored).
_env = ENGINE / ".env"
if _env.exists():
    for line in _env.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

from app.config import settings  # noqa: E402
from app.llm import LLMError, chat  # noqa: E402

FIELDS = ["ignition", "sustained_burn", "spread_observed", "extinguished", "evidence"]
SYSTEM = (
    "You label one combustion experiment run from the text of its own row only. "
    "Answer with JSON only. Use 'yes', 'no', or 'unknown'. Use 'unknown' whenever the row does not state it. "
    "Do not infer from the fuel or conditions. 'evidence' is a short quote from the row (max 25 words)."
)
PROMPT = (
    "Row (JSON):\n{row}\n\n"
    "Return a JSON object with keys: ignition (did the sample ignite), sustained_burn (did it keep burning "
    "after ignition), spread_observed (did the flame spread along the sample), extinguished (did the flame go out), "
    "evidence (short quote)."
)


def compact(row: dict) -> str:
    keep = {k: v for k, v in row.items() if k not in ("source_file", "raw_row_json") and v}
    try:
        raw = json.loads(row.get("raw_row_json") or "{}")
    except json.JSONDecodeError:
        raw = {}
    keep["raw"] = {k: v for k, v in raw.items() if v not in ("", None)}
    text = json.dumps(keep, ensure_ascii=False)
    return text[:3000]


def from_fields(row: dict) -> dict | None:
    """Explicit recorded fields first. Returns None when the row has no recognised outcome field."""
    try:
        raw = json.loads(row.get("raw_row_json") or "{}")
    except json.JSONDecodeError:
        return None
    end = str(raw.get("Test end", "")).strip().lower()
    if end:
        # FLEX: 'Extinction' = flame went out; 'Disruption' = droplet broke apart before burning out.
        if "extinction" in end:
            return {"extinguished": "yes", "_quote": f"Test end: {raw.get('Test end')}"}
        if "disruption" in end:
            return {"extinguished": "no", "_quote": f"Test end: {raw.get('Test end')}"}
    return None


def parse(text: str) -> dict:
    match = re.search(r"\{.*\}", text, re.S)
    data = json.loads(match.group(0)) if match else {}
    out = {}
    for key in ("ignition", "sustained_burn", "spread_observed", "extinguished"):
        val = str(data.get(key, "unknown")).lower().strip()
        out[key] = val if val in ("yes", "no", "unknown") else "unknown"
    out["evidence"] = str(data.get("evidence", ""))[:200]
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", default=str(Path(settings.dataset_path)))
    ap.add_argument("--limit", type=int, default=10)
    ap.add_argument("--dataset", default="", help="only rows whose dataset column equals this, e.g. FLEX")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    with open(args.csv, encoding="utf-8-sig", newline="") as f:
        rows = [r for r in csv.DictReader(f) if not args.dataset or r.get("dataset") == args.dataset][: args.limit]

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["row_index", "dataset", "psi_id", "test_id"] + FIELDS)
        for i, row in enumerate(rows):
            fixed = from_fields(row)
            if fixed:
                # Structured fields are read directly; the model is not trusted over an explicit field.
                labels = {**{k: "unknown" for k in FIELDS[:-1]}, **fixed, "evidence": fixed.pop("_quote", "")}
                fixed.pop("evidence", None)
            else:
                try:
                    labels = parse(chat(SYSTEM, PROMPT.format(row=compact(row)), max_tokens=300))
                except (LLMError, json.JSONDecodeError) as exc:
                    labels = {k: "error" for k in FIELDS[:-1]} | {"evidence": type(exc).__name__}
            w.writerow([i, row.get("dataset"), row.get("psi_id"), row.get("test_id")] + [labels.get(k, "") for k in FIELDS])
            print(i, labels)


if __name__ == "__main__":
    main()
