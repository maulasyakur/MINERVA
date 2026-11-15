"""Scenario explanation grounded in real NASA runs. Qualitative only: no spread rate, no fire-risk level."""
import json

from .config import settings
from .dataset import nearest
from .llm import chat
from .schemas import ExplainRequest

SYSTEM = (
    "You explain microgravity combustion scenarios for MINERVA, a NASA Space Apps fire-behavior explorer. "
    "Qualitative only: do not compute a spread rate, do not assign a fire-risk level, and do not call the scenario "
    "safe or unsafe. Base every claim on the RECORDED RUNS given in the prompt and on the scenario's own parameters "
    "(oxygen, airflow, pressure, gravity, material, flow direction). Never write that there is no evidence while runs "
    "are listed: compare the parameters you can match and state what differs. Do not invent results or numbers. "
    "Plain text only: no LaTeX, no markdown."
)

FORMAT = (
    "Write exactly five lines, each starting with its label and a colon:\n"
    "Verdict: one sentence on the overall hazard, citing the closest run(s) by row_index.\n"
    "What the flame would likely do: shape, colour, and whether it keeps burning, based on the runs.\n"
    "Why: the physics (gravity, oxygen, airflow, pressure, material), tied to the runs.\n"
    "Safety meaning for the crew: practical implications.\n"
    "Evidence and uncertainty: which runs match on which parameters, which do not, and what is extrapolated."
)


def explain(req: ExplainRequest) -> tuple[str, str]:
    scenario = req.model_dump()
    rows = nearest(scenario, k=10)
    runs = "\n".join(json.dumps(r, ensure_ascii=False) for r in rows)
    user = (
        f"Scenario (JSON): {json.dumps(scenario)}\n\n"
        f"RECORDED RUNS (10 nearest by match_cost, lower is closer; JSON, one per line):\n{runs}\n\n"
        f"{FORMAT}"
    )
    return chat(SYSTEM, user, max_tokens=700), settings.model
