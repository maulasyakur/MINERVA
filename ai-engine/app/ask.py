"""Question answering over retrieved dataset rows. The model may only use the rows it is given."""
import json

from .dataset import retrieve
from .llm import chat

SYSTEM = (
    "You answer questions about NASA microgravity combustion experiments. Use only the rows provided. "
    "Cite rows by row_index. If the rows do not answer the question, say so. Keep the answer under 150 words."
)


def answer(question: str, k: int) -> tuple[str, list[dict]]:
    rows = retrieve(question, k)
    if not rows:
        return ("No matching runs found. Try naming a material, a gravity level, or an oxygen concentration.", [])
    context = "\n".join(json.dumps(r, ensure_ascii=False) for r in rows)
    user = f"Question: {question}\n\nRows (JSON, one per line):\n{context}"
    return chat(SYSTEM, user, max_tokens=400), rows
