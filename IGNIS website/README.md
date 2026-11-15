# MINERVA – Safe Space Journey for All

A space-themed website for the NASA Space Apps microgravity combustion challenge.
You describe a fire scenario and MINERVA finds the closest recorded test runs in the NASA Physical
Science Informatics (PSI) combustion tables, summarises what happened in them, adds a labelled
physics approximation of flame spread, and says how well the data covers your scenario.

## Pages

`index.html` has three views:

- **Scenario builder** (`#home`): fuel type (solid, droplet, gas jet), gravity, fuel or material (from
  the data, with run counts), oxygen, airflow, pressure and flow direction, plus the swipeable habitat
  row. Press **Analyze scenario**.
- **Results** (`#results`): habitat summary and hazard verdict, the interpretation (rule-based, or
  AI-written on claude.ai), fire visualization, what the nearest test runs recorded, a physics
  spread-rate approximation checked against the data, a coverage chart, the five most relevant runs,
  every investigation in the dataset, and **Compare scenarios** (`#compare`) with an editable scenario B.
- **About** (`#about`): the "In space, fire has no up." landing section, facts computed from the
  data, the five-stage journey, and what's in the data.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Page layout and content (the only HTML file). |
| `css/styles.css` | All styles. |
| `js/app.js` | Matching, outcome summaries, physics approximation, chart, AI hook, compare view, routing, flame animation. |
| `data/psi_data.js` | The dataset the site uses (generated – do not edit by hand). |
| `scripts/build_data.py` | Builds `data/psi_data.js` from the merged PSI table. |

## Open it

Double-click `index.html`. The data is loaded as a script, so no server is needed. An internet
connection is only used for Google Fonts.

## Rebuild the data

The source is `../dataset-psi/merged_psi_combustion_v2.csv`. After changing it, run from this folder:

```
python scripts/build_data.py
```

The script drops 42 exact duplicate rows, converts pressure from atm to kPa, groups fuel labels into
fuels, pulls outcomes from each row's raw source values (FLEX test end, burn time, burning rate and
extinction diameter; CFI-G ignition, burn time and termination; Saffire burn time, spread rate and
1 g comparison; BASS-II final O₂), and marks runs not used for matching: smoke experiments (SAME,
SAME-R), test-design rows (FLEX-2), day summaries (ACME BRE, CLD), inverse flames and a cleaning run.
Assumptions are stored with each run: SPICE O₂ is set to 20.9% because its co-flow is air, and samples
listed only by shape (rod, sphere, film) are kept as "material not stated".

## How the results are built

- **Nearest runs (data).** For the chosen fuel type, each run's distance is the root-mean-square of the
  differences in O₂, log pressure, airflow and flow direction, each divided by that variable's standard
  deviation in the data, plus a penalty for a different fuel. A variable the run did not record counts as
  one standard deviation away; a variable that no run of your fuel records is skipped. The 10 nearest
  runs drive the outcome summary, and confidence comes from how many runs fall within half a standard
  deviation. Every run in the dataset is microgravity, so other gravity levels are flagged as extrapolated.
- **Flame spread rate (physics).** An order-of-magnitude approximation from de Ris thermal flame-spread
  scaling, using literature oxygen-limit values for PMMA, silicone, Ultem, SIBAL and Nomex, corrected for
  gravity (buoyant flow ≈ 30 cm/s × √g), forced airflow and pressure. Droplets use burning-rate scaling.
  The result is compared with any rate the nearest runs measured. Gas jets get no spread estimate.
- **Hazard verdict.** Uses recorded outcomes first (CFI-G ignition, FLEX extinction, Saffire burns) and
  the physics approximation only where no outcome was recorded.
- **AI answer.** On the published claude.ai page, "Ask MINERVA AI" (and every Analyze click) asks Claude
  to write the interpretation from the scenario, the nearest runs and the physics indicators. Opened
  locally or on GitHub Pages, a rule-based interpretation is shown instead.

## Limits

Many runs (BASS, CFI, SPICE, ACME Flame Design) record conditions but no outcome. The spread rate is a
physics approximation, not a measurement, and the flame animation is illustrative. Nothing here
replaces certified material flammability testing.

## Publish online (GitHub Pages)

Upload this folder (`index.html` with the `css`, `js` and `data` folders), then in **Settings → Pages**
choose the branch and folder that contain it.
