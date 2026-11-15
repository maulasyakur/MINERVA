"""API tests. The model is stubbed, so these run offline and never call OpenAI or RunPod."""
import pytest
from fastapi.testclient import TestClient

from app import ask as ask_mod
from app import columns as columns_mod
from app import explain as explain_mod
from app.dataset import nearest
from app.llm import LLMError
from app.main import app

client = TestClient(app)

SCENARIO = {"env": "craft", "g": 0.000001, "o2": 21, "flow": 20, "mat": "pmma", "p": None, "dir": "concurrent"}


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_explain_rejects_out_of_range_oxygen():
    r = client.post("/explain", json={**SCENARIO, "o2": 99})
    assert r.status_code == 422


def test_explain_prompt_includes_recorded_runs(monkeypatch):
    captured = {}

    def fake_chat(system, user, max_tokens=700):
        captured["system"], captured["user"] = system, user
        return "Verdict: test"

    monkeypatch.setattr(explain_mod, "chat", fake_chat)
    r = client.post("/explain", json=SCENARIO)
    assert r.status_code == 200
    assert "RECORDED RUNS" in captured["user"]
    assert "Never write that there is no evidence" in captured["system"]


def test_explain_returns_503_when_model_unavailable(monkeypatch):
    def boom(*_a, **_k):
        raise LLMError("OPENAI_API_KEY is not set", code="not_configured")

    monkeypatch.setattr(explain_mod, "chat", boom)
    r = client.post("/explain", json=SCENARIO)
    assert r.status_code == 503
    assert r.json()["code"] == "not_configured"
    assert "key" not in r.text.lower()  # no secrets or config details leak to the client


def test_rate_limit_maps_to_429(monkeypatch):
    def boom(*_a, **_k):
        raise LLMError("rate limited: RateLimitError", code="rate_limited")

    monkeypatch.setattr(explain_mod, "chat", boom)
    r = client.post("/explain", json=SCENARIO)
    assert r.status_code == 429
    assert r.json()["code"] == "rate_limited"
    assert "RateLimit" not in r.text  # exception names stay in the server log


def test_generate_rejects_short_prompt():
    r = client.post("/api/generate", json={"prompt": "too short"})
    assert r.status_code == 422


def test_columns_rule_fallback_maps_known_headers():
    mapping, method, confidence = columns_mod.map_columns(
        ["Run", "O2 (%)", "Airflow cm/s", "Pressure kPa", "Material", "Spread rate"], use_llm=False)
    assert method == "rules"
    assert mapping["o2"] == "O2 (%)"
    assert mapping["outcome"] == "Spread rate"
    assert confidence["o2"] == 1.0  # exact known name


def test_columns_pattern_match_has_lower_confidence():
    mapping, _, confidence = columns_mod.map_columns(["XO2 (init) fraction"], use_llm=False)
    assert mapping["o2"] == "XO2 (init) fraction"
    assert confidence["o2"] == 0.7  # matched by pattern, not by exact name
    assert confidence["material"] == 0.0


def test_columns_llm_answer_is_validated(monkeypatch):
    # The model may invent a header; only headers that exist in the file are accepted.
    monkeypatch.setattr(columns_mod, "chat", lambda *a, **k: '{"o2": "Made up", "material": "Material"}')
    mapping, method, _ = columns_mod.map_columns(["O2 (%)", "Material"], use_llm=True)
    assert method == "llm"
    assert mapping["o2"] is None
    assert mapping["material"] == "Material"


def test_nearest_returns_ranked_runs():
    rows = nearest(SCENARIO, k=10)
    assert len(rows) == 10
    costs = [r["match_cost"] for r in rows]
    assert costs == sorted(costs)


def test_ask_without_matches_does_not_call_model(monkeypatch):
    called = []
    monkeypatch.setattr(ask_mod, "chat", lambda *a, **k: called.append(1) or "x")
    text, rows = ask_mod.answer("zzzqqq nothing matches", k=3)
    assert rows == [] and called == []
    assert "No matching runs" in text


def test_ask_endpoint_returns_answer_and_sources(monkeypatch):
    monkeypatch.setattr(ask_mod, "chat", lambda *a, **k: "stub answer")
    r = client.post("/ask", json={"question": "Which runs used PMMA?", "top_k": 3})
    assert r.status_code == 200
    body = r.json()
    assert body["answer"] == "stub answer"
    assert all("row_index" in s for s in body["sources"])


def test_ask_endpoint_validates_input():
    assert client.post("/ask", json={"question": "ab"}).status_code == 422
    assert client.post("/ask", json={"question": "valid question", "top_k": 50}).status_code == 422


def test_columns_endpoint_rejects_empty_headers():
    assert client.post("/columns/map", json={"headers": []}).status_code == 422


def test_columns_endpoint_rule_path(monkeypatch):
    monkeypatch.setattr(columns_mod, "chat", lambda *a, **k: (_ for _ in ()).throw(LLMError("no key")))
    r = client.post("/columns/map", json={"headers": ["O2 (%)", "Material", "Spread rate"]})
    assert r.status_code == 200
    assert r.json()["method"] == "rules"
    assert r.json()["mapping"]["o2"] == "O2 (%)"


@pytest.mark.parametrize("path", ["/health", "/dataset/summary"])
def test_read_only_endpoints_ok(path):
    assert client.get(path).status_code == 200
