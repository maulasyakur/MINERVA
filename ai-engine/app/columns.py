"""Map CSV headers to standard fields. The LLM proposes; rules are the fallback and the validator."""
import json
import re

from .llm import LLMError, chat

FIELDS = ["o2", "airflow", "gravity", "pressure", "material", "outcome"]
PATTERNS = {
    "o2": [r"^o2", r"oxygen"],
    "airflow": [r"flow.*(cm|speed|vel)", r"velocity", r"air.?speed", r"^(air)?flow$"],
    "gravity": [r"grav", r"g.?level", r"^g$"],
    "pressure": [r"press", r"kpa", r"psi"],
    "material": [r"material", r"^fuel$", r"sample"],
    "outcome": [r"spread", r"burn.?rate", r"outcome", r"extinct", r"result"],
}


def rule_map(headers: list[str]) -> dict[str, str | None]:
    mapping: dict[str, str | None] = {}
    for field in FIELDS:
        found = None
        for pattern in PATTERNS[field]:
            found = next((h for h in headers if re.search(pattern, h.lower())), None)
            if found:
                break
        mapping[field] = found
    return mapping


def llm_map(headers: list[str]) -> dict[str, str | None]:
    system = "You map column headers from combustion experiment CSV files to standard fields. Reply with JSON only."
    user = (
        "Standard fields:\n"
        "- o2: oxygen concentration (%)\n"
        "- airflow: airflow speed (cm/s)\n"
        "- gravity: gravity level (g) or environment\n"
        "- pressure: pressure (kPa, atm or psi)\n"
        "- material: fuel or sample\n"
        "- outcome: spread rate, burning rate, extinction or result\n\n"
        f"Headers: {json.dumps(headers, ensure_ascii=False)}\n\n"
        "Return one JSON object with every standard field as a key. Each value must be exactly one header from the "
        "list, or null if none fits."
    )
    text = chat(system, user, max_tokens=300)
    match = re.search(r"\{.*\}", text, re.S)
    data = json.loads(match.group(0)) if match else None
    if not isinstance(data, dict):
        raise ValueError("model did not return a JSON object")
    allowed = set(headers)
    return {f: (data.get(f) if data.get(f) in allowed else None) for f in FIELDS}


def map_columns(headers: list[str], use_llm: bool) -> tuple[dict[str, str | None], str]:
    if use_llm:
        try:
            return llm_map(headers), "llm"
        except (LLMError, ValueError):  # json errors are ValueError subclasses
            pass
    return rule_map(headers), "rules"
