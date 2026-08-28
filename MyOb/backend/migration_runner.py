import argparse
import re
import sqlite3
import uuid
from pathlib import Path

MIGRATION_NAME = re.compile(r"^(\d+)_([a-z0-9_]+)\.sql$")
BUSY_TIMEOUT_MS = 5_000


def configure_sqlite(connection: sqlite3.Connection) -> None:
    connection.execute("PRAGMA journal_mode = WAL")
    connection.execute(f"PRAGMA busy_timeout = {BUSY_TIMEOUT_MS}")
    connection.execute("PRAGMA foreign_keys = ON")


def _legacy_owner_literal(connection: sqlite3.Connection, legacy_owner: str | None) -> str:
    owned_tables = ["notes", "folders", "video_summaries", "import_jobs", "conversations", "conversation_messages", "note_links", "ai_suggestions", "generated_images", "image_collections", "image_collection_memberships", "ai_settings"]
    row_count = sum(connection.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0] for table in owned_tables)
    if legacy_owner is None:
        if row_count:
            raise RuntimeError("Legacy MyOb rows require an explicit --legacy-owner <Mero user UUID>")
        return "NULL"
    parsed = uuid.UUID(legacy_owner)
    if parsed.version != 4:
        raise ValueError("Legacy owner must be a version 4 UUID")
    return f"'{str(parsed)}'"


def apply_migrations(database_path: str | Path, migrations_dir: str | Path | None = None, legacy_owner: str | None = None) -> list[int]:
    path = Path(database_path).resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    directory = Path(migrations_dir or Path(__file__).with_name("migrations"))
    migrations: list[tuple[int, Path]] = []
    for candidate in sorted(directory.glob("*.sql")):
        match = MIGRATION_NAME.fullmatch(candidate.name)
        if not match:
            raise ValueError(f"Invalid migration filename: {candidate.name}")
        migrations.append((int(match.group(1)), candidate))
    if len({version for version, _ in migrations}) != len(migrations):
        raise ValueError("Migration versions must be unique")

    connection = sqlite3.connect(path, isolation_level=None)
    try:
        configure_sqlite(connection)
        connection.execute(
            """CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )"""
        )
        applied = {row[0] for row in connection.execute("SELECT version FROM schema_migrations")}
        newly_applied: list[int] = []
        for version, migration_path in migrations:
            if version in applied:
                continue
            name = migration_path.name.replace("'", "''")
            script = migration_path.read_text(encoding="utf-8")
            if version == 2 and "{{LEGACY_OWNER}}" in script:
                script = script.replace("{{LEGACY_OWNER}}", _legacy_owner_literal(connection, legacy_owner))
            try:
                connection.executescript(
                    f"BEGIN IMMEDIATE;\n{script}\n"
                    f"INSERT INTO schema_migrations(version, name) VALUES ({version}, '{name}');\n"
                    "COMMIT;"
                )
            except Exception:
                if connection.in_transaction:
                    connection.rollback()
                raise
            newly_applied.append(version)
        return newly_applied
    finally:
        connection.close()


def main() -> None:
    from config import DB_PATH

    parser = argparse.ArgumentParser(description="Apply ordered MyOb SQLite migrations")
    parser.add_argument("--database", default=DB_PATH, help="SQLite database path")
    parser.add_argument("--legacy-owner", help="Version 4 Mero user UUID that owns every legacy row")
    args = parser.parse_args()
    applied = apply_migrations(args.database, legacy_owner=args.legacy_owner)
    print(f"Applied migrations: {applied or 'none'}")


if __name__ == "__main__":
    main()
