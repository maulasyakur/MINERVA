"""Request and response models. Validation happens here, at the system boundary."""
from typing import Annotated, Literal, Optional

from pydantic import BaseModel, Field

Env = Literal["general", "earth", "mars", "moon", "craft"]
Material = Literal["pe", "pmma", "sibal", "nomex", "paper", "silicone", "droplet", "gas"]
FlowDir = Literal["", "concurrent", "opposed", "quiescent"]
Header = Annotated[str, Field(min_length=1, max_length=100)]


class ExplainRequest(BaseModel):
    env: Env
    g: float = Field(ge=0, le=1.5)
    o2: float = Field(ge=10, le=40)
    flow: float = Field(ge=0, le=50)
    mat: Material
    p: Optional[float] = Field(default=None, ge=20, le=200)
    dir: FlowDir = ""


class GenerateRequest(BaseModel):
    prompt: str = Field(min_length=50, max_length=12000)


class ExplainResponse(BaseModel):
    text: str
    model: str


class ColumnMapRequest(BaseModel):
    headers: list[Header] = Field(min_length=1, max_length=200)
    use_llm: bool = True


class ColumnMapResponse(BaseModel):
    mapping: dict[str, Optional[str]]
    method: Literal["llm", "rules"]
    confidence: dict[str, float] = {}


class AskRequest(BaseModel):
    question: str = Field(min_length=3, max_length=500)
    top_k: int = Field(default=5, ge=1, le=10)


class AskResponse(BaseModel):
    answer: str
    sources: list[dict]
