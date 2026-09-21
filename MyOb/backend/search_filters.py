"""Shared search building blocks: filters, date phrases, FTS5 keyword search and match previews.

Every function here takes an explicit owner_id for raw SQL. The ORM tenant guard in
database.py only scopes ORM statements, so raw FTS5 queries must scope themselves.
"""

import re
from calendar import monthrange
from datetime import date, timedelta

from sqlalchemy import text

from database import Note, Project

PREVIEW_LIMIT = 200
MAX_FTS_TERMS = 16
MONTHS = {name.lower(): number for number, name in enumerate(
    ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"], start=1)}


def week_start(day: date) -> date:
    """Monday of the week containing `day` (PRD: weeks run Monday to Sunday)."""
    return day - timedelta(days=day.weekday())


def month_range(year: int, month: int) -> tuple[date, date]:
    return date(year, month, 1), date(year, month, monthrange(year, month)[1])


def parse_date_phrase(phrase: str, today: date) -> tuple[date, date] | None:
    """Turn a plain date phrase into an inclusive (from, to) range, or None if unrecognised.

    Deterministic and local: no AI call, so chat filters stay free and testable.
    """
    if not phrase:
        return None
    text_value = phrase.strip().lower()

    if text_value in ("today",):
        return today, today
    if text_value in ("yesterday",):
        return today - timedelta(days=1), today - timedelta(days=1)
    if text_value in ("this week",):
        return week_start(today), week_start(today) + timedelta(days=6)
    if text_value in ("last week",):
        previous = week_start(today) - timedelta(days=7)
        return previous, previous + timedelta(days=6)
    if text_value in ("this month",):
        return month_range(today.year, today.month)
    if text_value in ("last month",):
        year, month = (today.year - 1, 12) if today.month == 1 else (today.year, today.month - 1)
        return month_range(year, month)
    if text_value in ("this year",):
        return date(today.year, 1, 1), date(today.year, 12, 31)
    if text_value in ("last year",):
        return date(today.year - 1, 1, 1), date(today.year - 1, 12, 31)

    match = re.fullmatch(r"(?:in|during)\s+([a-z]+)(?:\s+(\d{4}))?", text_value)
    if match and match.group(1) in MONTHS:
        month = MONTHS[match.group(1)]
        if match.group(2):
            return month_range(int(match.group(2)), month)
        # A bare month name means the most recent one that has already started.
        year = today.year if month <= today.month else today.year - 1
        return month_range(year, month)

    match = re.fullmatch(r"(?:in|during)\s+(\d{4})", text_value)
    if match:
        year = int(match.group(1))
        return date(year, 1, 1), date(year, 12, 31)

    match = re.fullmatch(r"(?:the\s+)?last\s+(\d{1,3})\s+days?", text_value)
    if match:
        span = int(match.group(1))
        return today - timedelta(days=span - 1), today

    return None


def find_date_phrase(query: str, today: date) -> tuple[tuple[date, date], str] | None:
    """Find a date phrase inside a longer question and return the range plus the phrase found."""
    candidates = [
        r"\bthe last \d{1,3} days?\b", r"\blast \d{1,3} days?\b",
        r"\b(?:in|during) [a-z]+ \d{4}\b", r"\b(?:in|during) \d{4}\b", r"\b(?:in|during) [a-z]+\b",
        r"\blast week\b", r"\bthis week\b", r"\blast month\b", r"\bthis month\b",
        r"\blast year\b", r"\bthis year\b", r"\byesterday\b", r"\btoday\b",
    ]
    lowered = query.lower()
    for pattern in candidates:
        match = re.search(pattern, lowered)
        if not match:
            continue
        parsed = parse_date_phrase(match.group(0), today)
        if parsed:
            return parsed, match.group(0)
    return None


def apply_filters(query, filters: dict):
    """Apply the shared F2 filter set to an ORM query over Note."""
    if filters.get("from_date"):
        query = query.filter(Note.entry_date >= filters["from_date"])
    if filters.get("to_date"):
        query = query.filter(Note.entry_date <= filters["to_date"])
    if filters.get("space"):
        query = query.filter(Note.space == filters["space"])
    if filters.get("kind"):
        query = query.filter(Note.kind == filters["kind"])
    if filters.get("project_id"):
        query = query.filter(Note.project_id == filters["project_id"])
    if filters.get("client_id"):
        query = query.join(Project, (Project.id == Note.project_id) & (Project.owner_id == Note.owner_id)).filter(
            Project.client_id == filters["client_id"])
    if filters.get("note_ids") is not None:
        query = query.filter(Note.id.in_(filters["note_ids"] or [""]))
    if filters.get("folder_id"):
        query = query.filter(Note.folder_id == filters["folder_id"])
    return query


def fts_query_string(raw: str) -> str:
    """Quote every term so user punctuation can never inject FTS5 operator syntax."""
    terms = [term for term in re.findall(r"[\w']+", raw) if term][:MAX_FTS_TERMS]
    return " ".join(f'"{term}"' for term in terms)


def keyword_matches(db, owner_id: str, raw_query: str, limit: int = 500) -> dict[str, float]:
    """note_id -> normalised keyword score (0..1) from FTS5, scoped to one owner."""
    match_expression = fts_query_string(raw_query)
    if not match_expression or not owner_id:
        return {}
    rows = db.execute(
        text("""
            SELECT note_id, bm25(notes_fts, 10.0, 1.0) AS score
            FROM notes_fts
            WHERE notes_fts MATCH :match AND owner_id = :owner_id
            ORDER BY score
            LIMIT :limit
        """),
        {"match": match_expression, "owner_id": owner_id, "limit": limit},
    ).fetchall()
    if not rows:
        return {}
    # bm25 returns negative numbers, better matches more negative. Flip and scale to 0..1.
    best = min(row[1] for row in rows)
    if best == 0:
        return {row[0]: 1.0 for row in rows}
    return {row[0]: max(0.0, min(1.0, row[1] / best)) for row in rows}


def match_locations(note, raw_query: str) -> list[dict]:
    """Where the query hit this note, with the matching line, so a click can jump to it."""
    terms = [term.lower() for term in re.findall(r"[\w']+", raw_query)][:MAX_FTS_TERMS]
    if not terms:
        return []
    pattern = re.compile("|".join(re.escape(term) for term in terms), re.IGNORECASE)
    locations = []

    if pattern.search(note.title or ""):
        locations.append({"field": "title", "line": 0, "preview": (note.title or "")[:PREVIEW_LIMIT]})

    for index, line in enumerate((note.content or "").splitlines()):
        if not line.strip() or not pattern.search(line):
            continue
        locations.append({"field": "body", "line": index, "preview": line.strip()[:PREVIEW_LIMIT]})
        if len(locations) >= 5:
            break
    return locations


def filter_options(notes: list, projects_by_id: dict) -> dict:
    """Facet counts over the current result set, so no offered filter leads to an empty list."""
    spaces: dict[str, int] = {}
    kinds: dict[str, int] = {}
    project_counts: dict[str, int] = {}
    client_counts: dict[str, int] = {}

    for note in notes:
        spaces[note.space] = spaces.get(note.space, 0) + 1
        kinds[note.kind] = kinds.get(note.kind, 0) + 1
        if note.project_id:
            project_counts[note.project_id] = project_counts.get(note.project_id, 0) + 1
            client_id = (projects_by_id.get(note.project_id) or {}).get("client_id")
            if client_id:
                client_counts[client_id] = client_counts.get(client_id, 0) + 1

    def rows(counts: dict[str, int], names: dict | None = None) -> list[dict]:
        return sorted(
            [{"value": value, "count": count, **({"name": names[value]} if names and value in names else {})}
             for value, count in counts.items()],
            key=lambda row: (-row["count"], row["value"]),
        )

    project_names = {project_id: data["name"] for project_id, data in projects_by_id.items()}
    client_names = {data["client_id"]: data["client_name"] for data in projects_by_id.values() if data.get("client_id")}
    return {
        "space": rows(spaces),
        "kind": rows(kinds),
        "project_id": rows(project_counts, project_names),
        "client_id": rows(client_counts, client_names),
    }
