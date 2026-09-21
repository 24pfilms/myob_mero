"""Shared journal rules: word counts and plain-text name matching."""

import re

import frontmatter

from database import Client, Note, Project

KINDS = ("note", "entry", "summary")
SPACES = ("work", "personal")
ASSIGNMENTS = ("manual", "rule", "ai", "unassigned")
SOURCES = ("text", "voice", "import")
MAX_HINTS = 10
PREVIEW_LIMIT = 160


def body_text(content: str) -> str:
    """Note body without its frontmatter block."""
    if not content:
        return ""
    try:
        return frontmatter.loads(content).content
    except Exception:
        # Malformed frontmatter is still a note body; count it as written.
        return content


def body_word_count(content: str) -> int:
    return len(body_text(content).split())


def _match_line(body: str, name: str) -> str | None:
    pattern = re.compile(rf"(?<!\w){re.escape(name)}(?!\w)", re.IGNORECASE)
    for line in body.splitlines():
        if pattern.search(line):
            stripped = line.strip()
            return stripped[:PREVIEW_LIMIT] if stripped else None
    return None


def name_hints(db, note: Note) -> list[dict]:
    """Active client and project names mentioned in the note body, minus the one already assigned."""
    body = body_text(note.content or "")
    if not body.strip():
        return []

    hints: list[dict] = []
    for project in db.query(Project).filter(Project.status != "done").all():
        if project.id == note.project_id:
            continue
        preview = _match_line(body, project.name)
        if preview:
            hints.append({"kind": "project", "id": project.id, "name": project.name, "client_id": project.client_id, "preview": preview})
    for client in db.query(Client).filter(Client.archived == 0).all():
        preview = _match_line(body, client.name)
        if preview:
            hints.append({"kind": "client", "id": client.id, "name": client.name, "client_id": client.id, "preview": preview})
    return hints[:MAX_HINTS]
