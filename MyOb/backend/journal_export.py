"""Export every note, entry, client and project to one zip of markdown and CSV.

The zip stays on disk under DATA_DIR/exports and is never served over HTTP.
"""

import csv
import io
import re
import uuid
import zipfile
from datetime import datetime
from pathlib import Path

from config import DATA_DIR
from database import Client, Note, Project

EXPORTS_DIR = Path(DATA_DIR) / "exports"
_UNSAFE = re.compile(r"[^A-Za-z0-9 ._-]")
_RESERVED = {"CON", "PRN", "AUX", "NUL", *(f"COM{n}" for n in range(1, 10)), *(f"LPT{n}" for n in range(1, 10))}
MAX_SEGMENT = 80


def sanitize_segment(value: str, fallback: str) -> str:
    """One safe path segment: no separators, no traversal, no Windows reserved names."""
    cleaned = _UNSAFE.sub("_", (value or "").replace("/", "_").replace("\\", "_")).strip(" .")
    cleaned = cleaned[:MAX_SEGMENT].strip(" .")
    if not cleaned or set(cleaned) <= {"."} or cleaned.split(".")[0].upper() in _RESERVED:
        return fallback
    return cleaned


def _frontmatter(fields: dict) -> str:
    lines = ["---"]
    for key, value in fields.items():
        if value is None or value == [] or value == "":
            continue
        if isinstance(value, list):
            lines.append(f"{key}:")
            lines.extend(f'  - "{str(item)}"' for item in value)
        else:
            lines.append(f'{key}: "{str(value)}"')
    lines.append("---")
    return "\n".join(lines) + "\n\n"


def _note_fields(note: Note) -> dict:
    return {
        "id": note.id,
        "title": note.title,
        "kind": note.kind,
        "entry_date": note.entry_date.isoformat() if note.entry_date else None,
        "space": note.space,
        "project_id": note.project_id,
        "assignment": note.assignment,
        "source": note.source,
        "word_count": note.word_count,
        "tags": list(note.tags or []),
        "created_at": note.created_at.isoformat() if note.created_at else None,
        "updated_at": note.updated_at.isoformat() if note.updated_at else None,
    }


def _member_path(note: Note, taken: set[str]) -> str:
    space = note.space if note.space in ("work", "personal") else "work"
    title = sanitize_segment(note.title, sanitize_segment(note.id, "note"))
    if note.kind == "entry" and note.entry_date:
        folder = f"{space}/entries/{note.entry_date.year}"
        stem = sanitize_segment(f"{note.entry_date.isoformat()}-{title}", title)
    else:
        folder = f"{space}/notes"
        stem = title
    candidate = f"{folder}/{stem}.md"
    counter = 1
    while candidate.lower() in taken:
        candidate = f"{folder}/{stem}_{counter}.md"
        counter += 1
    taken.add(candidate.lower())
    return candidate


def _csv_bytes(header: list[str], rows: list[list]) -> bytes:
    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(header)
    writer.writerows(rows)
    return buffer.getvalue().encode("utf-8")


def export_archive(db, output_dir: Path | str | None = None, progress=None) -> Path:
    """Write the export zip and return its path. `progress(processed, total)` is called as it goes."""
    directory = Path(output_dir or EXPORTS_DIR)
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / f"mero-export-{datetime.utcnow().strftime('%Y%m%dT%H%M%S')}-{uuid.uuid4().hex[:8]}.zip"

    notes = db.query(Note).order_by(Note.created_at).all()
    clients = db.query(Client).order_by(Client.name).all()
    projects = db.query(Project).order_by(Project.name).all()
    total = len(notes) + 2

    taken: set[str] = set()
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
        for index, note in enumerate(notes, start=1):
            archive.writestr(_member_path(note, taken), _frontmatter(_note_fields(note)) + (note.content or ""))
            if progress:
                progress(index, total)
        archive.writestr(
            "tables/clients.csv",
            _csv_bytes(["id", "name", "archived", "created_at"], [[c.id, c.name, int(c.archived or 0), c.created_at.isoformat() if c.created_at else ""] for c in clients]),
        )
        archive.writestr(
            "tables/projects.csv",
            _csv_bytes(
                ["id", "name", "client_id", "status", "stale_after_days", "created_at"],
                [[p.id, p.name, p.client_id or "", p.status, p.stale_after_days, p.created_at.isoformat() if p.created_at else ""] for p in projects],
            ),
        )
    if progress:
        progress(total, total)
    return target
