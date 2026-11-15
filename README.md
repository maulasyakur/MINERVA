# MINERVA – Safe Space Journey for All

MINERVA is a web tool for the NASA Space Apps microgravity combustion challenge. You describe a fire
scenario (spacecraft cabin, Moon or Mars habitat, or an unspecified gravity), MINERVA finds the most
similar NASA combustion test runs in the PSI dataset, and it explains what those runs suggest about how
the flame behaves. An optional AI interpretation, served by a FastAPI service that uses the OpenAI SDK,
writes that explanation from the matched runs.

MINERVA is a prototype. It does not run a combustion simulation and does not assign a fire-risk level.

## Contents

| Path | What it is |
|------|------------|
| `IGNIS website/` | The static website (`index.html`, `css/`, `js/`, `data/`), a small Node server (`server/llm-proxy.js`), and its Dockerfile. Has its own README. |
| `ai-engine/` | FastAPI service that wraps the OpenAI SDK. Serves explanations, column mapping, dataset Q&A, and the endpoint the website calls. Has its own Dockerfile and tests. |
| `dataset-psi/` | NASA PSI combustion tables and the merged CSV (`merged_psi_combustion_v2.csv`) used for matching. |
| `docker-compose.yml` | Runs `ai-engine` and the website together. |

## Quick start

### Option 1: Docker Compose (recommended)

1. Create `ai-engine/.env` from `ai-engine/.env.example` and fill in your key and model (see
   [Configuration](#configuration)). The file is git-ignored.
2. From the repository root:

   ```bash
   docker compose up --build
   ```

3. Open the site at `http://127.0.0.1:8765`.
4. Check the AI service at `http://127.0.0.1:8000/health`, or the interactive API docs at
   `http://127.0.0.1:8000/docs`.

Both ports are bound to `127.0.0.1` only. The dataset folder is mounted read-only.

### Option 2: Run without Docker

Website only, with the rule-based interpretation. Double-click `IGNIS website/index.html`. The "Ask MINERVA AI"
button stays hidden when the page is opened as a file.

To serve the folder over HTTP instead, the button shows, but it reports an error unless the proxy or AI engine
is also running:

```bash
cd "IGNIS website"
python -m http.server 8765
```

Website with the Node proxy (needed for the "Ask MINERVA AI" button when not on claude.ai):

```bash
cd "IGNIS website"
set AI_ENGINE_URL=http://127.0.0.1:8000        # Windows; use export on macOS/Linux
node server/llm-proxy.js
```

AI engine:

```bash
cd ai-engine
python -m venv .venv && .venv\Scripts\activate  # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --port 8000
```

Tests (the model is stubbed, so no key or network is needed):

```bash
cd ai-engine
python -m pytest tests -q
```

## How the site works

1. **Scenario.** Pick an environment (spacecraft, Moon habitat, Mars habitat, Earth, or general), a
   fuel type and material, oxygen concentration, airflow speed, pressure (optional), and flow direction.
2. **Matching.** The site finds recorded runs that are close to the scenario on the variables that are
   set (oxygen, airflow, pressure, gravity, fuel). Variables the scenario does not set are skipped, not
   counted against every run.
3. **Evidence.** The matched runs are shown with their outcome summary and a confidence label
   (for example "Low · gravity not tested" when a gravity level has no recorded runs).
4. **Physics indicator.** A scaling-law estimate of the flame spread rate or burning rate, labelled as a
   calculated indicator, not a measurement. It is only shown where the scaling applies.
5. **Interpretation.** A rule-based text is always shown. "Ask MINERVA AI" replaces it with a model-written
   interpretation that is grounded in the matched runs. If the model is unavailable, the rule-based text
   stays and an error note explains why.
6. **Compare.** Two scenarios side by side, with the differences listed.

## AI engine (`ai-engine/`)

FastAPI application (`app/main.py`). All model calls go through one OpenAI SDK client, so the same code
works with OpenAI, OpenRouter, or a vLLM server (for example on RunPod) that exposes an OpenAI-compatible
API. Only the environment variables change.

### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Status, configured model and base URL, whether an API key is set. Never returns the key. |
| POST | `/api/generate` | Forwards a complete prompt to the model. Used by the website's "Ask MINERVA AI" button. Body: `{"prompt": "..."}`, 50 to 12,000 characters. |
| POST | `/explain` | Builds a scenario explanation from the 10 nearest real runs. Body: `env`, `g`, `o2`, `flow`, `mat`, `p` (kPa or null), `dir`. |
| POST | `/columns/map` | Maps CSV headers to standard fields (`o2`, `airflow`, `gravity`, `pressure`, `material`, `outcome`). Uses the model when available, otherwise rules. Any header the model invents is rejected. |
| POST | `/ask` | Answers a question about the dataset using the most relevant rows, and returns those rows as sources. Body: `question`, `top_k` (1 to 10). |
| GET | `/dataset/summary` | Number of rows in the configured dataset and its path. |
| POST | `/report` | Word (`.docx`) report for one scenario: inputs, the 10 closest recorded runs, the interpretation text, and limits. Body: `scenario` (`env`, `g`, `o2`, `flow`, `mat`, `p`, `dir`) and `narrative`. No model call. |
| GET | `/coverage` | Recorded runs per gravity × fuel class × O₂ band, plus the empty combinations. No model call. |

The website reaches these through `server/llm-proxy.js`: `/api/generate`, `/api/ask`, `/api/columns/map`,
`/api/report`, and `/api/coverage`. The model-backed routes are rate limited per client (20 to 30 requests a
minute, 10 for reports), and return `429` when exceeded.

### Scripts

- `ai-engine/scripts/extract_outcomes.py` labels each run's outcome. Explicit recorded fields come first (for
  FLEX, `Test end`). The model is used only for rows without such a field. Its output is a review file, not a
  training target until a person has checked it. `dataset-psi/derived/outcomes_flex.csv` holds the FLEX labels.

Input is validated with Pydantic at the boundary. Out-of-range values return `422`. If the model is not
configured or the request fails, the response is `503` with a generic message. Details go to the server log
only.

### How explanations stay grounded

- `nearest()` in `app/dataset.py` ranks every run by how well it matches the scenario's oxygen, airflow,
  pressure, gravity, and material. The top 10 are sent to the model as JSON.
- The system prompt requires the model to cite runs by `row_index`, to compare the parameters that match,
  and to say which parameters differ. It must not say there is no evidence while runs are listed.
- Output is plain text only (no LaTeX or markdown).

### Configuration

Set these as environment variables, or in `ai-engine/.env` (copy from `.env.example`).

| Variable | Default | Meaning |
|----------|---------|---------|
| `OPENAI_API_KEY` | empty | API key for the provider. May be empty for a vLLM server started without `--api-key`. |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | Any OpenAI-compatible endpoint. |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model name as the endpoint expects it. |
| `OPENAI_REASONING_EFFORT` | `none` | Sent as `reasoning_effort`. Set empty for models that reject it. When set, `temperature` is not sent. |
| `DATASET_PATH` | `../dataset-psi/merged_psi_combustion_v2.csv` | CSV used for matching and `/ask`. |

Example providers:

- **OpenAI:** leave `OPENAI_BASE_URL` at its default and set `OPENAI_MODEL` to a model you have access to.
- **OpenRouter or another hosted gateway:** set `OPENAI_BASE_URL` to the gateway's `/v1` URL and use the
  model name it lists.
- **vLLM on RunPod (Gemma):** `OPENAI_BASE_URL=https://<pod-id>-8000.proxy.runpod.net/v1`,
  `OPENAI_MODEL=google/gemma-3-27b-it` (or the model the server was started with).

## Website configuration

| Variable | Used by | Meaning |
|----------|---------|---------|
| `PORT` | `llm-proxy.js` | Port, default `8765`. |
| `HOST` | `llm-proxy.js` | Bind address, default `127.0.0.1`. The container sets `0.0.0.0`. |
| `AI_ENGINE_URL` | `llm-proxy.js` | If set, `/api/generate` is forwarded to the AI engine. Set to `http://ai-engine:8000` in Compose. |
| `RUNPOD_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY` | `llm-proxy.js` | Direct model access without the AI engine. Only used when `AI_ENGINE_URL` is not set. |

The page calls `/api/generate` only when it is served over `http`/`https`. Opened as a local file, the
AI button stays hidden.

## Data

- The source is `dataset-psi/merged_psi_combustion_v2.csv`. The website's bundled data comes from
  `IGNIS website/scripts/build_data.py`.
- Columns used for matching include `o2_pct`, `airflow_cm_s`, `pressure_atm`, `gravity_level`,
  `fuel_material`, `fuel_category`, and `flow_direction`. Missing values are treated as "not recorded",
  not as zero.
- Pressure in the CSV is in atm. The matching code converts it to kPa for comparison with the scenario.

## Security notes

- API keys live only in environment variables or `ai-engine/.env`. Neither is committed (`.gitignore`).
  Keys are never sent to the browser.
- The services listen on `127.0.0.1` on the host. Put a reverse proxy with authentication in front of
  them before exposing them to a network.
- Request bodies are size-limited (16 KB in the Node proxy, 12,000 characters for the prompt).
- Model output is shown as text (`textContent`), not as HTML.

## Limitations

- The matching uses a small number of variables, and many runs lack some of them. Confidence labels show
  how much the matches agree.
- Gravity levels other than microgravity have few or no recorded runs. Results for those levels are
  extrapolated, and the site says so.
- Model explanations can be wrong or incomplete. They are interpretation, not measurement. Check the cited
  runs before relying on a statement.
- The physics indicator is a scaling-law approximation, not a simulation.

## Project layout

```
MINERVA/
├── README.md
├── docker-compose.yml
├── dataset-psi/                 # PSI tables and merged CSV
├── ai-engine/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── .env.example
│   ├── app/
│   │   ├── main.py              # FastAPI routes
│   │   ├── config.py            # environment settings
│   │   ├── llm.py               # OpenAI SDK wrapper, error handling
│   │   ├── explain.py           # scenario explanation prompt
│   │   ├── dataset.py           # run matching and keyword retrieval
│   │   ├── columns.py           # CSV header mapping
│   │   ├── ask.py               # dataset Q&A
│   │   └── schemas.py           # request/response models
│   └── tests/test_api.py
└── IGNIS website/
    ├── Dockerfile
    ├── index.html
    ├── css/styles.css
    ├── js/app.js                # scenario, matching, interpretation, compare
    ├── data/psi_data.js         # generated from the PSI CSV
    ├── scripts/build_data.py
    └── server/llm-proxy.js      # static server and /api/generate proxy
```

## Acknowledgements

Built for the NASA Space Apps challenge. Background reading:
[NASA Glenn combustion science](https://www.nasa.gov/glenn/research/combustion-science/).
