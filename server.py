"""Craftory — craft supply inventory manager with Claude-powered planning."""

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

load_dotenv()

import anthropic
import uvicorn
from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.responses import StreamingResponse
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

DATA_FILE = Path(__file__).parent / "data" / "inventory.json"
IMAGES_DIR = Path(__file__).parent / "data" / "images"
CONVERSATIONS_DIR = Path(__file__).parent / "conversations"
FRONTEND_DIR = Path(__file__).parent / "frontend" / "dist"

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}

# ---------------------------------------------------------------------------
# Shared clients
# ---------------------------------------------------------------------------

claude_client = anthropic.Anthropic()  # reuse across requests

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class YarnItem(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    amount: float = 0
    brand: str = ""
    name: str = ""  # yarn line name, e.g. "Simply Soft"
    fiber_content: str = ""  # e.g. "100% Merino Wool"
    yardage: str = ""  # e.g. "217yds/100g"
    care_instructions: str = ""
    weight: str = ""  # e.g. "Worsted", "DK", "Fingering"
    colorway: str = ""
    dye_lot: str = ""
    recommended_needle: str = ""  # e.g. "US 7 / 4.5mm"
    recommended_hook: str = ""  # e.g. "H/8 / 5mm"
    knit_gauge_swatch: str = ""  # e.g. "20 sts x 26 rows = 4in on US 7"
    crochet_gauge_swatch: str = ""
    link: str = ""
    image: str = ""  # filename, e.g. "a3f8b2c91d04.png"
    discontinued: bool = False


class YarnUpdate(BaseModel):
    amount: Optional[float] = None
    brand: Optional[str] = None
    name: Optional[str] = None
    fiber_content: Optional[str] = None
    yardage: Optional[str] = None
    care_instructions: Optional[str] = None
    weight: Optional[str] = None
    colorway: Optional[str] = None
    dye_lot: Optional[str] = None
    recommended_needle: Optional[str] = None
    recommended_hook: Optional[str] = None
    knit_gauge_swatch: Optional[str] = None
    crochet_gauge_swatch: Optional[str] = None
    link: Optional[str] = None
    discontinued: Optional[bool] = None


class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []  # prior turns: [{role, content}, ...]


class ConversationExport(BaseModel):
    messages: list[dict]


# ---------------------------------------------------------------------------
# Data helpers
# ---------------------------------------------------------------------------


def read_inventory() -> list[dict]:
    if not DATA_FILE.exists():
        return []
    return json.loads(DATA_FILE.read_text())


def write_inventory(items: list[dict]) -> None:
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(json.dumps(items, indent=2))


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="Craftory")

# ---- Inventory CRUD ------------------------------------------------------


@app.get("/api/inventory")
def list_inventory():
    return read_inventory()


@app.post("/api/inventory", status_code=201)
def add_item(item: YarnItem):
    items = read_inventory()
    items.append(item.model_dump())
    write_inventory(items)
    return item.model_dump()


@app.get("/api/inventory/{item_id}")
def get_item(item_id: str):
    for item in read_inventory():
        if item["id"] == item_id:
            return item
    raise HTTPException(404, "Item not found")


@app.patch("/api/inventory/{item_id}")
def update_item(item_id: str, update: YarnUpdate):
    items = read_inventory()
    for item in items:
        if item["id"] == item_id:
            for key, value in update.model_dump(exclude_none=True).items():
                item[key] = value
            write_inventory(items)
            return item
    raise HTTPException(404, "Item not found")


@app.delete("/api/inventory/{item_id}")
def delete_item(item_id: str):
    items = read_inventory()
    new_items = [i for i in items if i["id"] != item_id]
    if len(new_items) == len(items):
        raise HTTPException(404, "Item not found")
    # Also delete the image file if one exists
    deleted_item = next(i for i in items if i["id"] == item_id)
    if deleted_item.get("image"):
        image_path = IMAGES_DIR / deleted_item["image"]
        image_path.unlink(missing_ok=True)
    write_inventory(new_items)
    return {"deleted": item_id}


# ---- Image upload/delete ---------------------------------------------------

IMAGES_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/api/images", StaticFiles(directory=IMAGES_DIR), name="images")


@app.post("/api/inventory/{item_id}/image", status_code=201)
async def upload_image(item_id: str, file: UploadFile):
    items = read_inventory()
    item = next((i for i in items if i["id"] == item_id), None)
    if not item:
        raise HTTPException(404, "Item not found")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(400, f"Unsupported image type: {ext}")

    # Remove old image if replacing
    if item.get("image"):
        old_path = IMAGES_DIR / item["image"]
        old_path.unlink(missing_ok=True)

    filename = f"{item_id}{ext}"
    dest = IMAGES_DIR / filename
    dest.write_bytes(await file.read())

    item["image"] = filename
    write_inventory(items)
    return {"image": filename}



# ---- Claude Chat ----------------------------------------------------------


def _build_system_prompt(inventory: list[dict]) -> str:
    if not inventory:
        inventory_text = "The inventory is currently empty."
    else:
        lines = []
        for item in inventory:
            label = f"{item.get('brand', '?')} {item.get('name', '')}".strip()
            parts = [f"- **{label} — {item.get('colorway', '?')}**"]
            if item.get("amount"):
                parts.append(f"  Amount: {item['amount']}")
            parts.append(f"  Weight: {item.get('weight', 'N/A')}")
            if item.get("fiber_content"):
                parts.append(f"  Fiber: {item['fiber_content']}")
            if item.get("yardage"):
                parts.append(f"  Yardage: {item['yardage']}")
            if item.get("care_instructions"):
                parts.append(f"  Care: {item['care_instructions']}")
            if item.get("dye_lot"):
                parts.append(f"  Dye lot: {item['dye_lot']}")
            if item.get("recommended_needle"):
                parts.append(f"  Recommended needle: {item['recommended_needle']}")
            if item.get("recommended_hook"):
                parts.append(f"  Recommended hook: {item['recommended_hook']}")
            if item.get("knit_gauge_swatch"):
                parts.append(f"  Knit gauge: {item['knit_gauge_swatch']}")
            if item.get("crochet_gauge_swatch"):
                parts.append(f"  Crochet gauge: {item['crochet_gauge_swatch']}")
            if item.get("discontinued"):
                parts.append("  Note: This yarn has been discontinued.")
            lines.append("\n".join(parts))
        inventory_text = "\n\n".join(lines)

    return f"""You are Craftory, a helpful assistant for a crafter who works with yarn.
You have access to the user's complete yarn inventory below. Use it to answer
questions, suggest projects, match materials to patterns, identify what they
need to buy, and recommend color combinations.

When the user describes a pattern or project, compare its requirements against
the inventory. Be specific about which yarns match, what's missing, and
possible substitutions. Consider weight, yardage, and color.

If the user asks what they can make, suggest projects that use what they
already have.

## Current Yarn Inventory

{inventory_text}
"""


@app.post("/api/chat")
def chat(req: ChatRequest):
    inventory = read_inventory()
    system = _build_system_prompt(inventory)

    messages = req.history + [{"role": "user", "content": req.message}]

    def generate():
        with claude_client.messages.stream(
            model="claude-opus-4-6",
            max_tokens=16384,
            system=system,
            messages=messages,
        ) as stream:
            for text in stream.text_stream:
                # SSE format: each chunk is "data: <json>\n\n"
                payload = json.dumps({"token": text})
                yield f"data: {payload}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


# ---- Conversation export --------------------------------------------------


@app.post("/api/conversations/export", status_code=201)
def export_conversation(req: ConversationExport):
    CONVERSATIONS_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    filepath = CONVERSATIONS_DIR / f"chat-{timestamp}.md"
    lines = [
        f"# Craftory Chat — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}\n"
    ]
    for msg in req.messages:
        role = "You" if msg.get("role") == "user" else "Craftory"
        lines.append(f"## {role}\n\n{msg.get('content', '')}\n")
    filepath.write_text("\n".join(lines))
    return {"file": str(filepath.name)}


# ---- Serve frontend -------------------------------------------------------

if FRONTEND_DIR.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        """Serve the React SPA for any non-API route."""
        return FileResponse(FRONTEND_DIR / "index.html")


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("🧶 Craftory running at http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
