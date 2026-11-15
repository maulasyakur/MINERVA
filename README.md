# MINERVA – Safe Space Journey for All

A space-themed website for the NASA Space Apps microgravity combustion challenge.

The site has three pages inside `index.html`:

- **Scenario builder** (`index.html` or `#home`): set gravity, material, oxygen, airflow,
  pressure and flow direction, pick a habitat from the swipeable row, and press **Analyze scenario**.
- **Results** (`#results`): habitat summary, "How we would interpret the safety and fire behavior"
  (AI answer), fire visualization, flame spread rate, the five most relevant studies, and
  **Compare scenarios** (`#compare`) with an editable "what if" scenario B.
- **About** (`#about`): the "In space, fire has no up." landing section, facts and the five-stage journey.

### How the results always give an answer

- **Flame spread rate** is always estimated. Without data it uses order-of-magnitude scaling
  (de Ris thermal flame-spread theory) from Earth-air baselines, corrected for oxygen margin above the
  material's limiting oxygen index, gravity (buoyant flow ≈ 30 cm/s × √g), forced airflow and pressure.
  Below the estimated limit it reports "≈ 0 · likely self-extinguishing". If a CSV with a spread/rate
  column is loaded, it switches to a similarity-weighted mean of the closest runs.
- **Most relevant studies** always lists the five closest experiments and says what had to be approximated.
- **AI answer**: on the published claude.ai page, "Ask MINERVA AI" (and every Analyze click) asks Claude
  to write the interpretation from the scenario, the estimate and the ranked evidence. When the file is
  opened locally or on GitHub Pages, AI is not available and a rule-based interpretation is shown instead.

## Files

| File | Purpose |
|------|---------|
| `index.html` | The whole website: layout, styles and scripts in one file. |
| `data/dataset_template.csv` | Column headers the evidence ranker recognises. Fill it with your NASA runs. |

## Open it

Double-click `index.html` to open it in a browser. An internet connection is needed only for the
Google Fonts; without it the page falls back to system fonts and still works.

## Rank your own NASA data

In the Fire Lab's **Most relevant studies** section, choose a `.csv` file. The page looks for columns whose
names contain these words (case does not matter):

- oxygen: `o2`, `oxygen`
- airflow: `flow`, `velocity`, `air speed`
- gravity: `grav`, `g level`, `g`
- pressure: `press`, `kpa`, `psi`
- material: `material`, `fuel`, `sample`
- experiment name: `experiment`, `test`, `id`, `name`, `run`
- outcome: `spread`, `rate`, `outcome`, `extinct`, `result`

Units the ranker assumes: oxygen in %, airflow in cm/s, gravity in g (e.g. 0.38), pressure in kPa.

## Publish online (GitHub Pages)

1. Create a GitHub repository and upload `index.html` (and the `data` folder if you want it).
2. In the repository, open **Settings → Pages**, choose the `main` branch and the root folder.
3. The site appears at `https://<your-username>.github.io/<repository-name>/`.

## Limits

This is a functional input prototype. It does not run a numerical combustion simulation or assign
fire risk; the flame animation is illustrative and the written interpretation is rule-based.
