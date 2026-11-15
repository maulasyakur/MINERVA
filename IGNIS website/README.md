# Minerva – Fire Behavior Explorer

A space-themed website for the NASA Space Apps microgravity combustion challenge.
It lets you configure a fire scenario (Earth, Moon habitat, Mars habitat or spacecraft cabin),
see an illustrative flame, read a qualitative interpretation, and rank comparable NASA experiments.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Page layout and content. |
| `css/styles.css` | All styles. |
| `js/app.js` | Flame animation, scenario analysis, evidence ranking and CSV loading. |
| `data/dataset_template.csv` | Column headers the evidence ranker recognises. Fill it with your NASA runs. |

## Open it

Double-click `index.html` to open it in a browser. An internet connection is needed only for the
Google Fonts; without it the page falls back to system fonts and still works.

## Rank your own NASA data

In the **Most relevant studies** section, choose a `.csv` file. The page looks for columns whose
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
