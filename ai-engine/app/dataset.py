"""Keyword retrieval over the merged PSI combustion CSV (no vector DB needed at this size)."""
import csv
import math
import re
from functools import lru_cache

from .config import settings

TEXT_FIELDS = ["dataset", "fuel_material", "fuel_category", "gravity_level", "atmosphere_type", "notes", "flow_direction"]
SHOW_FIELDS = ["dataset", "psi_id", "test_id", "fuel_material", "o2_pct", "airflow_cm_s",
               "pressure_atm", "gravity_level", "atmosphere_type", "notes"]


@lru_cache(maxsize=1)
def load_rows() -> list[dict]:
    with open(settings.dataset_path, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


MAT_TERMS = {"pe": "polyethylene", "pmma": "pmma", "sibal": "sibal", "nomex": "nomex",
             "paper": "paper", "silicone": "silicone", "droplet": "droplet", "gas": "gas"}


def _num(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _gravity_g(text: str | None):
    t = (text or "").lower()
    if re.search(r"micro|orbit|iss|space|flight", t):
        return 1e-6
    if re.search(r"lunar|moon", t):
        return 0.166
    if re.search(r"mars|martian", t):
        return 0.38
    if re.search(r"earth|normal|ground|1\s*g", t):
        return 1.0
    return None


def nearest(scenario: dict, k: int = 10) -> list[dict]:
    """Rank real runs by how closely they match the scenario's own parameters (O2, airflow, pressure, gravity, material)."""
    term = MAT_TERMS.get(scenario.get("mat", ""), "")
    scored = []
    for index, row in enumerate(load_rows()):
        cost = 0.0
        o2 = _num(row.get("o2_pct"))
        if o2 is not None:
            cost += ((o2 - scenario["o2"]) / 5) ** 2
        flow = _num(row.get("airflow_cm_s"))
        if flow is not None and scenario.get("dir") != "quiescent":
            cost += ((flow - scenario["flow"]) / 10) ** 2
        pressure = _num(row.get("pressure_atm"))
        if pressure is not None and scenario.get("p"):
            cost += ((pressure * 101.325 - scenario["p"]) / 20) ** 2
        g_row = _gravity_g(row.get("gravity_level"))
        if g_row is not None and scenario.get("g") is not None:
            cost += 0.5 * (math.log10(max(scenario["g"], 1e-6)) - math.log10(max(g_row, 1e-6))) ** 2
        if term and term not in (row.get("fuel_material") or "").lower():
            cost += 2.25
        scored.append((cost, index, row))
    scored.sort(key=lambda item: (item[0], item[1]))
    return [{"row_index": index, "match_cost": round(cost, 2), **{c: row.get(c) for c in SHOW_FIELDS}}
            for cost, index, row in scored[:k]]


def retrieve(question: str, k: int = 5) -> list[dict]:
    terms = {t for t in re.findall(r"[a-z0-9]+", question.lower()) if len(t) >= 3}
    if not terms:
        return []
    scored = []
    for index, row in enumerate(load_rows()):
        haystack = " ".join((row.get(c) or "") for c in TEXT_FIELDS).lower()
        score = sum(1 for t in terms if t in haystack)
        if score:
            scored.append((score, index, row))
    scored.sort(key=lambda item: (-item[0], item[1]))
    return [{"row_index": index, **{c: row.get(c) for c in SHOW_FIELDS}} for _, index, row in scored[:k]]
