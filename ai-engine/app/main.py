"""MINERVA AI engine: FastAPI service wrapping the OpenAI SDK (OpenAI or a vLLM server on RunPod)."""
from fastapi import FastAPI
from fastapi.responses import JSONResponse

from . import ask as ask_mod
from . import columns as columns_mod
from . import explain as explain_mod
from .config import settings
from .dataset import load_rows
from .llm import LLMError, chat
from .schemas import (AskRequest, AskResponse, ColumnMapRequest, ColumnMapResponse,
                      ExplainRequest, ExplainResponse, GenerateRequest)

GENERATE_SYSTEM = ("Follow the user's instructions exactly. Base every claim on the RECORDED RUNS in the prompt. "
                   "Never write that there is no evidence while runs are listed; compare the parameters that match and "
                   "state what differs. Use only numbers given in the prompt. Plain text only: no LaTeX, no markdown.")

app = FastAPI(title="MINERVA AI Engine", version="0.1.0")


@app.exception_handler(LLMError)
async def llm_error_handler(_request, exc: LLMError):
    # Log the reason server-side only; the client gets a generic message.
    print(f"[ai-engine] {exc}")
    return JSONResponse(status_code=503, content={"error": "AI model unavailable"})


@app.get("/health")
def health():
    return {"status": "ok", "model": settings.model, "base_url": settings.base_url,
            "api_key_set": bool(settings.api_key)}


@app.post("/explain", response_model=ExplainResponse)
def explain(req: ExplainRequest):
    text, model = explain_mod.explain(req)
    return ExplainResponse(text=text, model=model)


@app.post("/columns/map", response_model=ColumnMapResponse)
def map_columns(req: ColumnMapRequest):
    mapping, method = columns_mod.map_columns(req.headers, req.use_llm)
    return ColumnMapResponse(mapping=mapping, method=method)


@app.post("/ask", response_model=AskResponse)
def ask(req: AskRequest):
    text, rows = ask_mod.answer(req.question, req.top_k)
    return AskResponse(answer=text, sources=rows)


@app.post("/api/generate")
def generate(req: GenerateRequest):
    # Same contract the dashboard's "Ask MINERVA AI" button uses (see js/app.js gemmaSample).
    return {"text": chat(GENERATE_SYSTEM, req.prompt, max_tokens=700), "model": settings.model}


@app.get("/dataset/summary")
def dataset_summary():
    rows = load_rows()
    return {"runs": len(rows), "path": str(settings.dataset_path)}
