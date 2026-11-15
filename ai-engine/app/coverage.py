"""Experiment coverage: which gravity x fuel-class x oxygen combinations have recorded runs, and which have none."""
import collections
import re

from .dataset import load_rows

GRAVITY_CLASSES = {
    "moon_0.17g": re.compile(r"lunar|moon", re.I),
    "mars_0.38g": re.compile(r"mars|martian", re.I),
    "earth_1g": re.compile(r"earth|normal|ground|1\s*g\b", re.I),
    "microgravity": re.compile(r"micro|orbit|iss|space|flight", re.I),
}
FUEL_CLASSES = {"solid": "solid", "droplet": "droplet", "gas": "gas"}
O2_BANDS = [("<=16%", 0, 16), ("17-21%", 17, 21), (">21%", 21.0001, 100)]


def _gravity_class(text: str) -> str | None:
    for name, pattern in GRAVITY_CLASSES.items():
        if pattern.search(text or ""):
            return name
    return None


def _fuel_class(category: str) -> str | None:
    text = (category or "").lower()
    if "droplet" in text or "liquid" in text:
        return "droplet"
    if "gas" in text:
        return "gas"
    if "solid" in text:
        return "solid"
    return None


def _o2_band(value: str) -> str | None:
    try:
        o2 = float(value)
    except (TypeError, ValueError):
        return None
    for label, lo, hi in O2_BANDS:
        if lo <= o2 <= hi:
            return label
    return None


def coverage() -> dict:
    counts: collections.Counter = collections.Counter()
    no_o2 = 0
    for row in load_rows():
        g = _gravity_class(row.get("gravity_level", ""))
        f = _fuel_class(row.get("fuel_category", ""))
        if g is None or f is None:
            continue
        band = _o2_band(row.get("o2_pct") or row.get("o2_pct_final") or "")
        if band is None:
            no_o2 += 1
            continue
        counts[(g, f, band)] += 1

    cells = []
    for g in GRAVITY_CLASSES:
        for f in FUEL_CLASSES:
            for label, _, _ in O2_BANDS:
                cells.append({"gravity": g, "fuel": f, "o2_band": label, "runs": counts.get((g, f, label), 0)})
    gaps = [c for c in cells if c["runs"] == 0]
    return {"cells": cells, "gaps": gaps, "runs_without_o2": no_o2, "total_cells": len(cells)}
