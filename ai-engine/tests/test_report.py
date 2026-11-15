"""Report and coverage endpoints. No model calls: the report is built from recorded runs only."""
from fastapi.testclient import TestClient

from app.coverage import coverage
from app.main import app

client = TestClient(app)
SCENARIO = {"env": "craft", "g": 0.000001, "o2": 21, "flow": 20, "mat": "pmma", "p": None, "dir": "concurrent"}


def test_report_returns_a_docx():
    r = client.post("/report", json={"scenario": SCENARIO, "narrative": "Verdict: test line"})
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/vnd.openxmlformats")
    assert r.content[:2] == b"PK"  # docx is a zip archive


def test_report_rejects_bad_scenario():
    r = client.post("/report", json={"scenario": {**SCENARIO, "o2": 500}})
    assert r.status_code == 422


def test_coverage_counts_add_up():
    c = coverage()
    assert c["total_cells"] == len(c["cells"]) == 36
    assert len(c["gaps"]) == sum(1 for x in c["cells"] if x["runs"] == 0)


def test_coverage_endpoint():
    r = client.get("/coverage")
    assert r.status_code == 200
    assert "gaps" in r.json()
