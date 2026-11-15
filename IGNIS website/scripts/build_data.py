"""Build data/psi_data.js from the merged NASA PSI combustion table.

Usage (from the website folder):
    python scripts/build_data.py [path/to/merged_psi_combustion_v2.csv]

Default input: ../dataset-psi/merged_psi_combustion_v2.csv
Output: data/psi_data.js, which sets window.PSI. It is a .js file (not .json) so the
site also works when index.html is opened straight from disk.

Every number the site shows about the experiments comes from this file. Values are
taken from the merged table's columns or, for outcomes, from each row's raw_row_json
(the untouched source row). Nothing here is invented; where a value is assumed or
inferred, the run carries a note saying so.
"""
import csv
import json
import re
import statistics
import sys
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE.parent / "dataset-psi" / "merged_psi_combustion_v2.csv"
OUT = HERE / "data" / "psi_data.js"
ATM_KPA = 101.325

# ---------------------------------------------------------------- families
# Descriptions are limited to what the source tables themselves show.
FAMILIES = {
    "BASS": dict(name="BASS", full="Burning and Suppression of Solids", cat="solid",
                 desc="Small solid samples (PMMA slabs and spheres, SIBAL fabric, Nomex, wax candles, Ultem) burned in the ISS Microgravity Science Glovebox. The table lists the sample for each run but no oxygen, airflow or outcome."),
    "BASS-II": dict(name="BASS-II", full="Burning and Suppression of Solids II", cat="solid",
                    desc="Follow-on solid-fuel runs with oxygen lowered by adding nitrogen. Records the chamber O₂ before and after each burn; airflow is only given as fan dial settings, not cm/s."),
    "SAFFIRE-I": dict(name="Saffire-I", full="Spacecraft Fire Safety Experiment I", cat="solid",
                      desc="Large SIBAL cotton-fiberglass sheets burned inside an uncrewed Cygnus cargo vehicle at 20 cm/s, one with concurrent and one with opposed flow."),
    "SAFFIRE-II": dict(name="Saffire-II", full="Spacecraft Fire Safety Experiment II", cat="solid",
                       desc="Nine smaller samples (silicone, SIBAL, PMMA, Nomex) burned in Cygnus at 20 cm/s. The table compares microgravity burn length and spread rate with 1 g results for the same materials."),
    "SAFFIRE-III": dict(name="Saffire-III", full="Spacecraft Fire Safety Experiment III", cat="solid",
                        desc="Two large SIBAL sheets burned in Cygnus at 30 cm/s, concurrent and opposed flow. The table lists conditions only."),
    "FLEX": dict(name="FLEX", full="Flame Extinguishment Experiment", cat="droplet",
                 desc="Free-floating methanol and heptane droplets burned in still gas in the ISS Combustion Integrated Rack, with O₂, pressure and diluent (N₂, CO₂, He) varied. Records burn time, burning rate, extinction diameter and how each test ended."),
    "FLEX-2": dict(name="FLEX-2", full="Flame Extinguishment Experiment 2", cat="droplet",
                   desc="Test-design summary: one row per fuel giving the planned ranges of O₂, pressure and flow. These are not individual runs, so they are listed but not used for matching."),
    "CFI": dict(name="CFI", full="Cool Flames Investigation (droplets)", cat="droplet",
                desc="n-dodecane and dodecane/iso-dodecane droplets at 1–5 atm in O₂/N₂ or O₂/He, some fiber-supported. The table lists conditions only."),
    "ACME Flame Design (normal)": dict(name="ACME Flame Design · normal", full="ACME Flame Design, normal flames", cat="gas",
                                       desc="Ethylene and propane jet flames burning into an O₂/N₂ chamber, with fuel dilution and O₂ varied. The table lists conditions and computed flame properties, not outcomes."),
    "ACME Flame Design (inverse)": dict(name="ACME Flame Design · inverse", full="ACME Flame Design, inverse flames", cat="gas",
                                        desc="Inverse flames: an oxygen jet burning into an ethylene/N₂ chamber. Its O₂ value is the jet's, not the atmosphere's, so it is not used for matching cabin scenarios."),
    "ACME CFI-G (normal)": dict(name="ACME CFI-G · normal", full="ACME Cool Flames Investigation with Gases, normal flames", cat="gas",
                                desc="Ethane, propane and butane jet flames in O₂/N₂ at about 1–3 bar. Records whether a hot flame ignited, how long it burned, whether it self-extinguished, and cool-flame observations."),
    "ACME CFI-G (inverse)": dict(name="ACME CFI-G · inverse", full="ACME Cool Flames Investigation with Gases, inverse flames", cat="gas",
                                 desc="Oxygen jets burning into a fuel/N₂ chamber. Records ignition, burn time, termination and flame colour; not used for matching cabin scenarios because the chamber holds fuel, not air."),
    "SPICE": dict(name="SPICE", full="Smoke Point In Co-flow Experiment", cat="gas",
                  desc="Ethylene, propylene, propane and methane jet flames inside a co-flowing air stream, with fuel rate and air speed varied. The table lists conditions only."),
    "ACME BRE": dict(name="ACME BRE", full="ACME Burner Radiant Emission", cat="gas",
                     desc="One row per test day: ethylene or methane burner flames at several O₂ levels, with the number of flames ignited. Chamber pressure is not listed. Day summaries are not used for matching."),
    "ACME CLD Flame": dict(name="ACME CLD Flame", full="ACME Coflow Laminar Diffusion Flame", cat="gas",
                           desc="One row per test day: diluted methane or ethylene co-flow flames with the number of flames ignited. Day summaries are not used for matching."),
    "SAME": dict(name="SAME", full="Smoke Aerosol Measurement Experiment", cat="smoke",
                 desc="Heated (not burning) spacecraft materials producing smoke for detector research. Not a flame experiment, so it is not used for matching."),
    "SAME-R": dict(name="SAME-R", full="Smoke Aerosol Measurement Experiment – Reflight", cat="smoke",
                   desc="Smoke from heated Kapton, silicone, lampwick, Pyrell and Teflon, aged in flow. Not a flame experiment, so it is not used for matching."),
}

# ---------------------------------------------------------------- fuels
FUELS = {
    # solids
    "pmma": ("PMMA (acrylic)", "solid", "Clear thermoplastic; the most common reference solid in these runs (films, slabs, spheres)."),
    "pmma_like": ("Rod / sphere, material not stated", "solid", "BASS and BASS-II rows that give only a shape (e.g. '1/4\" black rod', '2 cm sphere'). Other rows in the same tables name PMMA rods and spheres, but these rows do not."),
    "sibal": ("SIBAL cotton-fiberglass fabric", "solid", "Thin cotton/fiberglass blend fabric used as the large Saffire sample."),
    "nomex": ("Nomex fabric", "solid", "Flame-resistant aramid fabric."),
    "silicone": ("Silicone", "solid", "Silicone sheet; in Saffire-II these samples barely burned in microgravity."),
    "wax": ("Wax candle / slab", "solid", "Paraffin and Japan-wax candles and slabs: the solid melts and the vapour burns."),
    "ultem": ("Ultem sheet", "solid", "Polyetherimide engineering plastic."),
    "solid_other": ("Other / unlabelled solid", "solid", "Composite or unlabelled samples (e.g. 'PMMA & Nomex', blank material cells)."),
    # droplets
    "methanol": ("Methanol", "droplet", "Light alcohol that burns with an almost soot-free flame."),
    "heptane": ("n-Heptane", "droplet", "Reference hydrocarbon fuel; FLEX found many heptane flames lingering as cool flames."),
    "dodecane": ("n-Dodecane", "droplet", "Heavier alkane studied for low-temperature (cool-flame) chemistry."),
    "dodecane_blend": ("n-Dodecane / iso-dodecane blend", "droplet", "60/40 and 75/25 blends of normal and branched dodecane."),
    # gases
    "ethylene": ("Ethylene (C₂H₄)", "gas", "Sooty hydrocarbon gas; the main ACME Flame Design and BRE fuel."),
    "propylene": ("Propylene", "gas", "Sooty gas; most of the SPICE runs."),
    "propane": ("Propane (C₃H₈)", "gas", "Common bottled fuel gas."),
    "ethane": ("Ethane", "gas", "Light alkane gas used in the CFI-G cool-flame runs."),
    "butane": ("Butane", "gas", "Alkane gas with active low-temperature chemistry; most CFI-G cool flames used it."),
    "methane": ("Methane (CH₄)", "gas", "Lightest hydrocarbon; little soot."),
}

CAT_OF = {"solid": "solid", "liquid droplet": "droplet"}


def fuel_key(label, cat):
    s = label.lower()
    if cat == "solid":
        if "&" in s or "blank" in s or not s.strip():
            return "solid_other"
        if "pmma" in s:
            return "pmma"
        if "sibal" in s or "cotton" in s:
            return "sibal"
        if "nomex" in s:
            return "nomex"
        if "silicone" in s:
            return "silicone"
        if "wax" in s or "candle" in s:
            return "wax"
        if "ultem" in s:
            return "ultem"
        if re.search(r"rod|sphere|film|spherical", s):
            return "pmma_like"
        return "solid_other"
    if cat == "droplet":
        if "iso-dodecane" in s:
            return "dodecane_blend"
        if "c12h26" in s or "dodecane" in s:
            return "dodecane"
        if "methanol" in s:
            return "methanol"
        if "heptane" in s and "isooctane" not in s:
            return "heptane"
        return None
    if cat == "gas":
        for k, pats in [("ethylene", ["c2h4", "ethylene"]), ("propylene", ["propylene"]), ("propane", ["propane", "c3h8"]), ("methane", ["ch4", "methane"]),
                        ("ethane", ["ethane"]), ("butane", ["butane"]), ("methane", ["ch4", "methane"])]:
            if any(p in s for p in pats):
                return k
    return None


def fnum(v):
    if v is None:
        return None
    m = re.search(r"-?\d*\.?\d+(?:[eE][+-]?\d+)?", str(v))
    return float(m.group(0)) if m else None


def rnd(v, n=3):
    return None if v is None else round(v, n)


def category(row):
    c = row["fuel_category"]
    if c == "solid":
        return "solid"
    if c == "liquid droplet":
        return "droplet"
    if c.startswith("gaseous"):
        return "gas"
    return "smoke"


def outcomes(fam, raw, row):
    o = {}
    if fam == "FLEX":
        o["end"] = raw.get("Test end") or None
        o["bt"] = fnum(raw.get("Burn time; s"))
        o["K"] = fnum(raw.get("Burning rate; mm"))
        de = raw.get("Visible flame extinction diameter; mm", "")
        o["dext"] = fnum(de) if de not in ("", "–", "-") else None
        o["d0"] = fnum(raw.get("Droplet initial diameter; mm"))
    elif fam.startswith("ACME CFI-G"):
        hi = (raw.get("Hot ignition") or "").strip().lower()
        o["ign"] = {"yes": "yes", "no": "no", "flash": "flash"}.get(hi)
        o["bt"] = fnum(raw.get("burn time (sec)"))
        term = (raw.get("Self-ext or flow term") or raw.get("Self -ext or flow term") or "").strip()
        o["term"] = term if term in ("SE", "FT") else None
        cf = (raw.get("Cool flame?") or "").lower()
        com = (raw.get("Comments") or "").lower()
        o["cool"] = cf.startswith("yes") or ("cool" in com and "no" not in cf)
        col = (raw.get("Color") or "").strip().lower()
        o["color"] = col if col and col not in ("-", "limit") else None
    elif fam.startswith("SAFFIRE"):
        bt = raw.get("Burn Time (s)")
        if bt:
            o["bt"] = 0.0 if "insignificant" in bt.lower() else fnum(bt)
            if "insignificant" in bt.lower():
                o["btNote"] = "insignificant"
        sp = raw.get("?-g Spread Length", "")
        if "mm/s" in sp:
            o["spread"] = fnum(sp)
        if raw.get("?-g Burn Length"):
            o["ugBurn"] = raw["?-g Burn Length"]
        if raw.get("1-g Burn Length"):
            o["g1Burn"] = raw["1-g Burn Length"]
        if raw.get("1-g Spread Rate"):
            o["g1Spread"] = raw["1-g Spread Rate"]
    elif fam == "BASS-II":
        f = fnum(row["o2_pct_final"])
        if f is not None:
            o["o2f"] = f
    elif fam in ("ACME BRE", "ACME CLD Flame"):
        n = fnum(raw.get("Flames Ignited") or raw.get("Flames ignited"))
        if n is not None:
            o["nIgn"] = n
    return {k: v for k, v in o.items() if v not in (None, False)}


def main():
    rows = list(csv.DictReader(open(SRC, encoding="utf-8-sig")))
    runs, seen, dupes = [], set(), 0
    for row in rows:
        fam = row["dataset"]
        raw = json.loads(row["raw_row_json"] or "{}")
        cat = category(row)
        notes = []
        excl = None
        if cat == "smoke":
            excl = "smoke experiment, not a flame"
        elif fam == "FLEX-2":
            excl = "test-design ranges, not an individual run"
        elif fam in ("ACME BRE", "ACME CLD Flame"):
            excl = "one row per test day, not an individual run"
        elif "inverse" in fam:
            excl = "inverse flame: oxygen jet into a fuel atmosphere"
        if (row["fuel_material"] or "").lower().startswith("soot"):
            excl = "cleaning run, no sample"

        key = fuel_key(row["fuel_material"], cat) if cat != "smoke" else None
        if cat in ("droplet", "gas") and key is None and not excl:
            excl = "fuel not in the matching list"

        o2 = fnum(row["o2_pct"])
        o2jet = None
        if "not ambient" in row["o2_location"]:
            o2jet, o2 = o2, None
        if fam == "SPICE" and o2 is None:
            o2 = 20.9
            notes.append("O₂ assumed 20.9% (co-flow is air)")
        if fam in ("ACME BRE",):
            o2 = None  # several levels per day; kept in raw text
        p = fnum(row["pressure_atm"])
        p = p * ATM_KPA if p else None
        v = fnum(row["airflow_cm_s"])
        if v is not None and v < 0:
            notes.append("negative air rate in source")
        d = (row["flow_direction"] or "").strip().lower() or None
        dil = None
        if row["he_mole_frac"] and float(row["he_mole_frac"]) > 0:
            dil = "He"
        elif row["co2_mole_frac"] and float(row["co2_mole_frac"]) > 0:
            dil = "CO₂"
        elif row["n2_mole_frac"] and float(row["n2_mole_frac"]) > 0:
            dil = "N₂"
        frac = re.match(r"\s*\[?([\d.]+)\s*%", row["fuel_material"] or "")

        date = row["date_iso"] or None
        if date and date[:4] > "2025":
            notes.append(f"date '{date}' in source looks wrong, not used")
            date = None

        sig = (fam, row["raw_row_json"])
        if sig in seen:
            dupes += 1
            continue  # exact duplicate rows in the source (SPICE, CFI)
        seen.add(sig)

        r = dict(f=fam, t=row["test_id"] or f"row {row['source_row']}", c=cat, u=key,
                 fr=(row["fuel_material"] or "").strip() or "(blank in source)",
                 o=rnd(o2, 2), oj=rnd(o2jet, 2), p=rnd(p, 1), v=rnd(v, 2),
                 vk=("coflow" if fam == "SPICE" else "cabin" if fam.startswith("SAFFIRE") else None),
                 d=d, dil=dil, ff=(float(frac.group(1)) if frac else None),
                 date=date, src=f"{row['source_file']} · row {row['source_row']}",
                 out=outcomes(fam, raw, row), n="; ".join(notes) or None, x=excl)
        if fam in ("ACME BRE",):
            r["oRange"] = row["o2_raw"]
        runs.append({k: v for k, v in r.items() if v not in (None, {}, "")})

    # ------------------------------------------------------------ family stats
    fams = {}
    by = defaultdict(list)
    for r in runs:
        by[r["f"]].append(r)
    for k, meta in FAMILIES.items():
        rs = by.get(k, [])
        def rng(field):
            vals = [r[field] for r in rs if field in r]
            return [round(min(vals), 2), round(max(vals), 2)] if vals else None
        measured = sorted({m for r in rs for m in r.get("out", {})})
        psi = next((row["psi_id"] for row in rows if row["dataset"] == k), "")
        dates = sorted(r["date"] for r in rs if "date" in r)
        fams[k] = dict(meta, psi=psi, n=len(rs), nMatch=sum(1 for r in rs if "x" not in r),
                       o2=rng("o"), o2jet=rng("oj"), p=rng("p"), v=rng("v"),
                       fuels=dict(Counter(FUELS[r["u"]][0] if r.get("u") else r["fr"] for r in rs).most_common()),
                       measured=measured, years=[dates[0][:4], dates[-1][:4]] if dates else None)

    fuels = {}
    for k, (name, cat, note) in FUELS.items():
        rs = [r for r in runs if r.get("u") == k and "x" not in r]
        fuels[k] = dict(name=name, cat=cat, note=note, n=len(rs),
                        fams=sorted({r["f"] for r in rs}))

    # ------------------------------------------------------------ headline facts (all computed)
    flex = by["FLEX"]
    ends = Counter(r["out"].get("end") for r in flex if r["out"].get("end"))
    s1 = {r.get("d"): r["out"].get("bt") for r in by["SAFFIRE-I"]}
    s2 = [r for r in by["SAFFIRE-II"] if r["u"] == "silicone"]
    s2_insig = sum(1 for r in s2 if r["out"].get("btNote") == "insignificant")
    s2_1g = sum(1 for r in s2 if (r["out"].get("g1Burn") or "").lower().startswith("complete"))
    cfig = by["ACME CFI-G (normal)"] + by["ACME CFI-G (inverse)"]
    ign = [r for r in cfig if r["out"].get("ign")]
    match_runs = [r for r in runs if "x" not in r]
    facts = dict(
        flexN=len(flex), flexExt=ends.get("Extinction", 0), flexDis=ends.get("Disruption", 0), flexComp=ends.get("Completion", 0),
        saffireConc=s1.get("concurrent"), saffireOpp=s1.get("opposed"),
        siliconeN=len(s2), siliconeInsig=s2_insig, silicone1gComplete=s2_1g,
        cfigN=len(ign), cfigNoIgn=sum(1 for r in ign if r["out"]["ign"] == "no"),
        cfigCool=sum(1 for r in cfig if r["out"].get("cool")),
    )
    o2s = [r["o"] for r in match_runs if "o" in r]
    ps = [r["p"] for r in match_runs if "p" in r]
    vs = [r["v"] for r in match_runs if "v" in r]
    meta = dict(source=SRC.name, rows=len(rows), runs=len(runs), dupesDropped=dupes, matchRuns=len(match_runs),
                families=len([f for f in fams.values() if f["n"]]),
                gravity=dict(Counter(row["gravity_level"] for row in rows)),
                o2=[min(o2s), max(o2s)], p=[min(ps), max(ps)], v=[min(vs), max(vs)],
                years=[min(r["date"] for r in runs if "date" in r)[:4], max(r["date"] for r in runs if "date" in r)[:4]],
                cats={c: sum(1 for r in match_runs if r["c"] == c) for c in ("solid", "droplet", "gas")})

    data = dict(meta=meta, facts=facts, families=fams, fuels=fuels, runs=runs)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    js = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    OUT.write_text("/* Generated by scripts/build_data.py from " + SRC.name + " - do not edit by hand. */\n"
                   "window.PSI=" + js + ";\n", encoding="utf-8")
    print(f"{len(runs)} runs ({dupes} duplicate rows dropped), {len(match_runs)} usable for matching -> {OUT}")
    print("facts:", facts)
    print("meta:", {k: v for k, v in meta.items() if k != 'gravity'})
    for k, f in fuels.items():
        print(f"  {k:15} {f['n']:4}  {f['fams']}")


if __name__ == "__main__":
    main()
