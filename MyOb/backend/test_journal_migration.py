import hashlib
import sqlite3
import tempfile
import unittest
from pathlib import Path

from migration_runner import apply_migrations

OWNER = "123e4567-e89b-42d3-a456-426614174000"


def _note_hash(connection: sqlite3.Connection) -> str:
    rows = connection.execute("SELECT owner_id, id, title, content, tags, folder_id, created_at, updated_at FROM notes ORDER BY id").fetchall()
    return hashlib.sha256(repr(rows).encode("utf-8")).hexdigest()


class JournalMigrationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.database = Path(self.temp.name) / "populated.db"
        fixture = Path(__file__).with_name("test_fixtures") / "legacy_database.sql"
        connection = sqlite3.connect(self.database)
        try:
            connection.executescript(fixture.read_text(encoding="utf-8"))
        finally:
            connection.close()
        # Everything up to 005, so 006 applies on top of a populated database.
        self.assertEqual(apply_migrations(self.database, legacy_owner=OWNER)[-1], 6)

    def test_existing_notes_are_unchanged_and_entry_defaults_land(self):
        connection = sqlite3.connect(self.database)
        try:
            self.assertEqual(
                connection.execute("SELECT kind, entry_date, space, project_id, assignment, source, word_count, extracted, period_type, period_start FROM notes WHERE id = 'legacy-note'").fetchone(),
                ("note", None, "work", None, "manual", "text", 0, None, None, None),
            )
            self.assertEqual(connection.execute("SELECT content FROM notes WHERE id = 'legacy-note'").fetchone()[0], "# Preserved")
            before = _note_hash(connection)
        finally:
            connection.close()

        self.assertEqual(apply_migrations(self.database), [])

        connection = sqlite3.connect(self.database)
        try:
            self.assertEqual(_note_hash(connection), before)
        finally:
            connection.close()

    def test_new_tables_indexes_and_constraints_exist(self):
        connection = sqlite3.connect(self.database)
        connection.execute("PRAGMA foreign_keys = ON")
        try:
            tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
            self.assertLessEqual({"clients", "projects", "jobs"}, tables)
            indexes = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type = 'index'")}
            self.assertLessEqual({"idx_notes_entry_date", "idx_notes_project_entry_date", "idx_notes_summary_period", "idx_jobs_queue"}, indexes)

            version_columns = {row[1] for row in connection.execute("PRAGMA table_info(note_versions)")}
            self.assertLessEqual({"space", "project_id"}, version_columns)

            with self.assertRaises(sqlite3.IntegrityError):
                connection.execute("INSERT INTO projects (owner_id, id, name, status, created_at) VALUES (?, 'p1', 'Bad', 'archived', '2026-01-01')", (OWNER,))
            with self.assertRaises(sqlite3.IntegrityError):
                connection.execute("INSERT INTO jobs (owner_id, id, type, status, created_at, updated_at) VALUES (?, 'j1', 'export', 'weird', '2026-01-01', '2026-01-01')", (OWNER,))
        finally:
            connection.close()

    def test_summary_period_uniqueness_ignores_plain_notes(self):
        connection = sqlite3.connect(self.database)
        try:
            for note_id in ("plain-1", "plain-2"):
                connection.execute(
                    "INSERT INTO notes (owner_id, id, title, content, tags, created_at, updated_at) VALUES (?, ?, 'Plain', 'body', '[]', '2026-01-01', '2026-01-01')",
                    (OWNER, note_id),
                )
            connection.execute(
                "INSERT INTO notes (owner_id, id, title, content, tags, kind, period_type, period_start, created_at, updated_at) VALUES (?, 'sum-1', 'Week', 'body', '[]', 'summary', 'week', '2026-01-05', '2026-01-01', '2026-01-01')",
                (OWNER,),
            )
            with self.assertRaises(sqlite3.IntegrityError):
                connection.execute(
                    "INSERT INTO notes (owner_id, id, title, content, tags, kind, period_type, period_start, created_at, updated_at) VALUES (?, 'sum-2', 'Week again', 'body', '[]', 'summary', 'week', '2026-01-05', '2026-01-01', '2026-01-01')",
                    (OWNER,),
                )
        finally:
            connection.close()


if __name__ == "__main__":
    unittest.main()
