"""Label each run's outcome from its recorded fields, by fixed rules. No model involved.

Each rule reads one explicit field and maps its value to yes / no / unknown. A value a rule does not recognise
stays unknown. Every label records the field it came from, so it can be checked.

Usage (from ai-engine/):
    python scripts/label_rules.py --out ../dataset-psi/derived/outcomes_rules.csv
"""
import argparse
import csv
import json
import sys
from pathlib import Path

ENGINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ENGINE))

from app.config import settings  # noqa: E402

OUT_FIELDS = ["row_index", "dataset", "psi_id", "test_id", "ignition", "sustained_burn", "extinguished", "source"]


def _yes_no(value: str) -> str | None:
    v = str(value or "").strip().lower()
    if v in ("yes", "y", "true"):
        return "yes"
    if v in ("no", "n", "false"):
        return "no"
    return None


def label(raw: dict, dataset: str, row: dict) -> dict:
    out = {"ignition": "unknown", "sustained_burn": "unknown", "extinguished": "unknown", "source": ""}
    notes = []

    def set_(key, value, src):
        if value is not None and out[key] == "unknown":
            out[key] = value
            notes.append(src)

    # FLEX droplets: explicit test end.
    end = str(raw.get("Test end", "")).strip().lower()
    if "extinction" in end:
        set_("extinguished", "yes", "Test end")
    elif "disruption" in end:
        # NASA/TP-2015-216046: a disruption ended the test before the flame went out.
        set_("extinguished", "no", "Test end")
    elif "completion" in end:
        # NASA/TP-2015-216046: the droplet burned to completion, so no visible flame extinction occurred.
        set_("extinguished", "no", "Test end")

    # ACME CFI-G: hot ignition and self-extinguishing (SE). FT is ambiguous, so it is left unknown.
    set_("ignition", _yes_no(raw.get("Hot ignition")), "Hot ignition")
    se = str(raw.get("Self-ext or flow term", raw.get("Self -ext or flow term", ""))).strip().upper()
    if se == "SE":
        set_("extinguished", "yes", "Self-ext")

    # SPICE: a recorded ignition time means the run was ignited. "GMT Flame Off" is NOT used for extinction:
    # the SPICE test procedure (DeBold, UMD thesis, Ch. 2) turns the fuel and igniter off at the end of each run,
    # so the recorded time is when the operator stopped the flame, not when it went out on its own.
    if str(raw.get("GMT ignition", "")).strip():
        set_("ignition", "yes", "GMT ignition")

    # SAFFIRE-II: 1-g burn length. "Complete" = the sample burned through; "~ 0" = it did not burn.
    burn = str(raw.get("1-g Burn Length", "")).strip().lower()
    if burn.startswith("complete"):
        set_("sustained_burn", "yes", "1-g Burn Length")
    elif burn.startswith("~ 0") or burn == "0":
        set_("sustained_burn", "no", "1-g Burn Length")

    # ACME BRE / CLD: recorded flames ignited.
    # The field holds a count of flames ignited in the test (NASA ACME reports count "flames ignited").
    # A count above zero means at least one flame was ignited; zero means none was.
    ign = str(raw.get("Flames Ignited", raw.get("Flames ignited", ""))).strip()
    if ign.isdigit():
        set_("ignition", "yes" if int(ign) > 0 else "no", "Flames Ignited (count)")

    out["source"] = "; ".join(notes)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", default=str(Path(settings.dataset_path)))
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    counts = {"rows": 0, "any_label": 0}
    with open(args.csv, encoding="utf-8-sig", newline="") as f, open(out_path, "w", encoding="utf-8", newline="") as o:
        w = csv.DictWriter(o, fieldnames=OUT_FIELDS)
        w.writeheader()
        for i, row in enumerate(csv.DictReader(f)):
            try:
                raw = json.loads(row.get("raw_row_json") or "{}")
            except json.JSONDecodeError:
                raw = {}
            res = label(raw, row.get("dataset", ""), row)
            counts["rows"] += 1
            if res["source"]:
                counts["any_label"] += 1
            w.writerow({"row_index": i, "dataset": row.get("dataset"), "psi_id": row.get("psi_id"),
                        "test_id": row.get("test_id"), **res})
    print(counts)


if __name__ == "__main__":
    main()
