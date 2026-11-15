"""MINERVA AI engine: FastAPI service wrapping the OpenAI SDK (OpenAI or a vLLM server on RunPod)."""
from fastapi import FastAPI
from fastapi.responses import JSONResponse, Response

from . import ask as ask_mod
from . import audit
from . import coverage as coverage_mod
from .report import ReportRequest, build_report
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


LLM_ERRORS = {
    # code: (HTTP status, message the client may see). Details stay in the server log only.
    "not_configured": (503, "AI is not configured on the server."),
    "rate_limited": (429, "The AI service is busy. Try again in a minute."),
    "timeout": (504, "The AI service took too long to answer. Try again."),
    "auth": (503, "The AI service rejected the server's credentials."),
    "unreachable": (503, "The AI service cannot be reached right now."),
    "upstream": (502, "The AI service returned an error."),
}


@app.exception_handler(LLMError)
async def llm_error_handler(_request, exc: LLMError):
    status, message = LLM_ERRORS.get(exc.code, LLM_ERRORS["upstream"])
    print(f"[ai-engine] {exc.code}: {exc}")
    return JSONResponse(status_code=status, content={"error": message, "code": exc.code})


@app.get("/health")
def health():
    return {"status": "ok", "model": settings.model, "base_url": settings.base_url,
            "api_key_set": bool(settings.api_key)}


@app.post("/explain", response_model=ExplainResponse)
def explain(req: ExplainRequest):
    text, model = explain_mod.explain(req)
    audit.record("explain", str(req.model_dump()), text, model)
    return ExplainResponse(text=text, model=model)


@app.post("/columns/map", response_model=ColumnMapResponse)
def map_columns(req: ColumnMapRequest):
    mapping, method, confidence = columns_mod.map_columns(req.headers, req.use_llm)
    return ColumnMapResponse(mapping=mapping, method=method, confidence=confidence)


@app.post("/ask", response_model=AskResponse)
def ask(req: AskRequest):
    text, rows = ask_mod.answer(req.question, req.top_k)
    audit.record("ask", req.question, text, settings.model)
    return AskResponse(answer=text, sources=rows)


@app.post("/api/generate")
def generate(req: GenerateRequest):
    # Same contract the dashboard's "Ask MINERVA AI" button uses (see js/app.js gemmaSample).
    text = chat(GENERATE_SYSTEM, req.prompt, max_tokens=700)
    audit.record("generate", req.prompt, text, settings.model)
    return {"text": text, "model": settings.model}


@app.get("/dataset/summary")
def dataset_summary():
    rows = load_rows()
    return {"runs": len(rows), "path": str(settings.dataset_path)}


@app.post("/report")
def report(req: ReportRequest):
    data = build_report(req)
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": 'attachment; filename="minerva-scenario.docx"'},  # no model call
    )


@app.get("/coverage")
def experiment_coverage():
    # Counts recorded runs per gravity x fuel class x oxygen band; no model involved.
    return coverage_mod.coverage()
