# Minerva – Fire Behavior Explorer

A space-themed website for the NASA Space Apps microgravity combustion challenge.
You describe a fire scenario (environment, fuel, oxygen, pressure, airflow, flow direction) and the
site finds the closest test runs in the NASA Physical Science Informatics (PSI) combustion tables,
summarises what was recorded in them, and says how well the data covers your scenario.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Page layout and content. |
| `css/styles.css` | All styles. |
| `js/app.js` | Matching, outcome summaries, coverage chart, readout, compare view and flame animation. |
| `data/psi_data.js` | The dataset the site uses (generated – do not edit by hand). |
| `scripts/build_data.py` | Builds `data/psi_data.js` from the merged PSI table. |

## Open it

Double-click `index.html`. The data is loaded as a script, so no server is needed. An internet
connection is only used for Google Fonts.

## Rebuild the data

The source is `../dataset-psi/merged_psi_combustion_v2.csv` (one folder up from this one).
After changing it, run from this folder:

```
python scripts/build_data.py
```

The script:

- keeps every row but drops 42 exact duplicate rows (SPICE, CFI);
- converts pressure from atm to kPa;
- groups fuel labels into fuels (e.g. "C2H4", "Ethylene", "100% C2H4" → ethylene);
- pulls outcomes from each row's raw source values: FLEX test end, burn time, burning rate and
  extinction diameter; CFI-G ignition, burn time and termination; Saffire burn time, spread rate and
  1 g comparison; BASS-II final O₂;
- marks runs that are not used for matching: smoke experiments (SAME, SAME-R), test-design rows
  (FLEX-2), day summaries (ACME BRE, CLD), inverse flames, and a cleaning run.

Assumptions are stored with each run and shown on the page: SPICE O₂ is set to 20.9% because its
co-flow is air; samples listed only by shape (rod, sphere, film) are kept as "material not stated".

## How matching works

For the chosen fuel type, each run's distance to your scenario is the root-mean-square of the
differences in O₂, log pressure, airflow and flow direction, each divided by that variable's
standard deviation in the data, plus a penalty for a different fuel. A variable the run did not
record counts as one standard deviation away; a variable that no run of your fuel records is skipped.
The 10 nearest runs drive the outcome summary. Confidence comes from how many runs fall within
half a standard deviation.

## Limits

Every run in the dataset was done in microgravity. Moon, Mars and Earth scenarios use the same
microgravity runs and are flagged as extrapolations. Many runs (BASS, CFI, SPICE, ACME Flame
Design) record conditions but no outcome. The flame animation is illustrative and the buoyancy
estimate (≈ 30 cm/s × √g) is a rule of thumb, not data.

## Publish online (GitHub Pages)

Upload `index.html` with the `css`, `js` and `data` folders, then in **Settings → Pages** choose the
`main` branch and the root folder.
