"""Word report for one scenario: inputs, the closest recorded runs, the interpretation text, and limits."""
from io import BytesIO
from typing import Optional

from docx import Document
from pydantic import BaseModel, Field

from .dataset import nearest


class ReportScenario(BaseModel):
    env: str = Field(min_length=1, max_length=40)
    g: float = Field(ge=0, le=1.5)
    o2: float = Field(ge=0, le=100)
    flow: float = Field(ge=0, le=100)
    mat: str = Field(default="", max_length=40)
    p: Optional[float] = Field(default=None, ge=0, le=500)
    dir: str = Field(default="", max_length=20)


class ReportRequest(BaseModel):
    scenario: ReportScenario
    narrative: str = Field(default="", max_length=4000)


def build_report(req: ReportRequest) -> bytes:
    s = req.scenario.model_dump()
    rows = nearest(s, k=10)
    doc = Document()
    doc.add_heading("MINERVA scenario report", level=1)
    doc.add_paragraph("Qualitative summary from recorded NASA combustion runs. This is not a simulation "
                      "and not a fire-risk rating.")

    doc.add_heading("Scenario", level=2)
    table = doc.add_table(rows=0, cols=2)
    table.style = "Light Grid Accent 1"
    labels = {"env": "Environment", "g": "Gravity (g)", "o2": "Oxygen (%)", "flow": "Airflow (cm/s)",
              "mat": "Material", "p": "Pressure (kPa)", "dir": "Flow direction"}
    for key, label in labels.items():
        value = s.get(key)
        cells = table.add_row().cells
        cells[0].text = label
        cells[1].text = "not specified" if value in (None, "") else str(value)

    doc.add_heading("Closest recorded runs", level=2)
    if rows:
        doc.add_paragraph("Lower match cost means the run is closer on oxygen, airflow, pressure, gravity, and material.")
        for r in rows:
            doc.add_paragraph(
                f"row {r['row_index']} · {r.get('dataset') or '—'} {r.get('psi_id') or ''} test {r.get('test_id') or '—'} · "
                f"{r.get('fuel_material') or '—'} · O₂ {(str(r.get('o2_pct')) + '%') if r.get('o2_pct') else 'not recorded'} · "
                f"airflow {r.get('airflow_cm_s') or 'not recorded'} cm/s · match cost {r['match_cost']}",
                style="List Bullet")
    else:
        doc.add_paragraph("No runs matched this scenario.")

    if req.narrative.strip():
        doc.add_heading("Interpretation", level=2)
        for line in req.narrative.splitlines():
            if line.strip():
                doc.add_paragraph(line.strip())

    doc.add_heading("Limits", level=2)
    doc.add_paragraph("Matching uses a few variables, and many runs do not record all of them. Gravity levels with no "
                      "recorded runs are extrapolated. Check the cited runs before relying on any statement.")

    buf = BytesIO()
    doc.save(buf)
    return buf.getvalue()
