"""Map CSV headers to standard fields. Exact names from NASA-style tables score highest; patterns next; the model last.

Each mapped field carries a confidence: 1.0 for an exact known name, 0.9 for the model's choice (validated against
the headers), 0.7 for a pattern match, and 0.0 when nothing matched. The UI asks the user to check anything below 0.8.
"""
import json
import re

from .llm import LLMError, chat

FIELDS = ["o2", "airflow", "gravity", "pressure", "material", "outcome"]

# Exact header names seen in NASA combustion tables (the PSI merged file and the source tables).
EXACT = {
    "o2": ["o2 (%)", "o2 %", "o2", "o2_pct", "xo2", "xo2 before test", "oxygen (%)", "o2 mole fraction"],
    "airflow": ["airflow cm/s", "airflow_cm_s", "air rate (cm/s)", "airflow (cm/s)", "flow velocity (cm/s)"],
    "gravity": ["gravity", "gravity_level", "g-level", "gravity level"],
    "pressure": ["pressure kpa", "pressure (kpa)", "pressure_atm", "pressure (atm)", "pressure (psi)", "pressure atm"],
    "material": ["material", "fuel sample material", "fuel", "fuel_material", "sample"],
    "outcome": ["spread rate", "burning rate", "outcome", "test end", "extinction", "1-g spread rate"],
}

PATTERNS = {
    "o2": [r"^o2", r"oxygen", r"^xo2"],
    "airflow": [r"flow.*(cm|speed|vel)", r"velocity", r"air.?speed", r"^(air)?flow$"],
    "gravity": [r"grav", r"g.?level", r"^g$"],
    "pressure": [r"press", r"kpa", r"psi"],
    "material": [r"material", r"^fuel$", r"sample"],
    "outcome": [r"spread", r"burn.?rate", r"outcome", r"extinct", r"result"],
}


def rule_map(headers: list[str]) -> dict[str, tuple[str | None, float]]:
    scored: dict[str, tuple[str | None, float]] = {}
    lowered = {h: h.lower().strip() for h in headers}
    for field in FIELDS:
        exact = next((h for h in headers if lowered[h] in EXACT[field]), None)
        if exact:
            scored[field] = (exact, 1.0)
            continue
        found = None
        for pattern in PATTERNS[field]:
            found = next((h for h in headers if re.search(pattern, lowered[h])), None)
            if found:
                break
        scored[field] = (found, 0.7 if found else 0.0)
    return scored


def llm_map(headers: list[str]) -> dict[str, tuple[str | None, float]]:
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
    return {f: ((data.get(f) if data.get(f) in allowed else None), 0.9 if data.get(f) in allowed else 0.0)
            for f in FIELDS}


def map_columns(headers: list[str], use_llm: bool):
    """Return (mapping, method, confidence). mapping[field] is a header or None."""
    if use_llm:
        try:
            scored = llm_map(headers)
            return ({f: h for f, (h, _) in scored.items()}, "llm", {f: c for f, (_, c) in scored.items()})
        except (LLMError, ValueError):  # json errors are ValueError subclasses
            pass
    scored = rule_map(headers)
    return ({f: h for f, (h, _) in scored.items()}, "rules", {f: c for f, (_, c) in scored.items()})
