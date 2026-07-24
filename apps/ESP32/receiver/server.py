"""
Home-server ingest for AtomS3R devices (scale weigh-ins and later use cases).

Runs on any always-reachable machine on your LAN — laptop now, Mac mini later.
Point each Atom's "Home server address" at this host (IP or .local name).

Usage:
  cd receiver
  python3 -m venv .venv
  .venv/bin/pip install -r requirements.txt
  .venv/bin/python server.py
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
import uvicorn

DATA_DIR = Path(__file__).resolve().parent / "data"
DATA_DIR.mkdir(exist_ok=True)
JSONL_PATH = DATA_DIR / "weigh_ins.jsonl"
TOKEN = os.environ.get("INGEST_TOKEN", "")

app = FastAPI(title="Runstar weigh-in receiver", version="0.1.0")


class WeighIn(BaseModel):
    source: str = "runstar-r6"
    device: str = "atoms3r-ext"
    phase: str = Field(description="measuring | final")
    weight_kg: float
    raw: int | None = None
    ts_ms: int | None = None


def _check_auth(authorization: str | None) -> None:
    if not TOKEN:
        return
    expected = f"Bearer {TOKEN}"
    if authorization != expected:
        raise HTTPException(status_code=401, detail="unauthorized")


@app.get("/health")
def health() -> dict:
    return {"ok": True, "saved": JSONL_PATH.exists()}


@app.post("/weigh-ins")
async def weigh_ins(
    payload: WeighIn,
    authorization: str | None = Header(default=None),
) -> dict:
    _check_auth(authorization)
    record = payload.model_dump()
    record["received_at"] = datetime.now(timezone.utc).isoformat()
    with JSONL_PATH.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record) + "\n")
    print(f"saved {record['phase']}: {record['weight_kg']:.2f} kg")
    return {"ok": True, "record": record}


@app.get("/weigh-ins")
def list_weigh_ins(limit: int = 50) -> dict:
    if not JSONL_PATH.exists():
        return {"items": []}
    lines = JSONL_PATH.read_text(encoding="utf-8").strip().splitlines()
    items = [json.loads(line) for line in lines[-limit:]]
    items.reverse()
    return {"items": items}


@app.get("/", response_class=HTMLResponse)
def index() -> str:
    items = list_weigh_ins(20)["items"]
    rows = "".join(
        f"<tr><td>{i.get('received_at','')}</td>"
        f"<td>{i.get('phase','')}</td>"
        f"<td>{i.get('weight_kg','')}</td></tr>"
        for i in items
    )
    return f"""<!doctype html>
<html><head><meta charset="utf-8"><title>Weigh-ins</title>
<style>
body{{font-family:ui-sans-serif,system-ui;margin:2rem;background:#111;color:#eee}}
table{{border-collapse:collapse;width:100%;max-width:40rem}}
td,th{{border-bottom:1px solid #333;padding:.5rem;text-align:left}}
</style></head><body>
<h1>Runstar weigh-ins</h1>
<p>POST target: <code>/weigh-ins</code> · data file: <code>{JSONL_PATH}</code></p>
<table><thead><tr><th>Received</th><th>Phase</th><th>kg</th></tr></thead>
<tbody>{rows or '<tr><td colspan=3>No readings yet</td></tr>'}</tbody></table>
</body></html>"""


if __name__ == "__main__":
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8765"))
    print(f"listening on http://{host}:{port}")
    print(f"saving to {JSONL_PATH}")
    uvicorn.run(app, host=host, port=port, log_level="info")
