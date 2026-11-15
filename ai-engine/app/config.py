"""Runtime settings, read from environment variables (never hard-coded)."""
import os
from dataclasses import dataclass
from pathlib import Path

ENGINE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_BASE_URL = "https://api.openai.com/v1"


@dataclass(frozen=True)
class Settings:
    api_key: str        # OPENAI_API_KEY; leave empty for a local vLLM server without auth
    base_url: str       # OPENAI_BASE_URL; point at RunPod vLLM to serve Gemma through the same SDK
    model: str          # OPENAI_MODEL; e.g. gpt-4o-mini, or google/gemma-3-27b-it on vLLM
    dataset_path: Path  # DATASET_PATH; defaults to the merged PSI combustion CSV
    reasoning_effort: str  # OPENAI_REASONING_EFFORT; "none" turns reasoning off, empty = don't send


settings = Settings(
    api_key=os.getenv("OPENAI_API_KEY", ""),
    base_url=os.getenv("OPENAI_BASE_URL", DEFAULT_BASE_URL).rstrip("/"),
    model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
    reasoning_effort=os.getenv("OPENAI_REASONING_EFFORT", "none").strip(),
    dataset_path=Path(os.getenv(
        "DATASET_PATH",
        ENGINE_DIR.parent / "dataset-psi" / "merged_psi_combustion_v2.csv",
    )),
)
