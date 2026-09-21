import sqlite3
import tempfile
import unittest
from pathlib import Path

from migration_runner import apply_migrations


class MigrationTests(unittest.TestCase):
    def test_seeded_legacy_database_migrates_without_data_loss(self):
        with tempfile.TemporaryDirectory() as directory:
            database_path = Path(directory) / "legacy.db"
            connection = sqlite3.connect(database_path)
            try:
                fixture = Path(__file__).with_name("test_fixtures") / "legacy_database.sql"
                connection.executescript(fixture.read_text(encoding="utf-8"))
            finally:
                connection.close()

            owner = "123e4567-e89b-42d3-a456-426614174000"
            with self.assertRaisesRegex(RuntimeError, "--legacy-owner"):
                apply_migrations(database_path)
            self.assertEqual(apply_migrations(database_path, legacy_owner=owner), [2, 3, 4, 5, 6, 7])
            self.assertEqual(apply_migrations(database_path), [])

            connection = sqlite3.connect(database_path)
            try:
                self.assertEqual(connection.execute("SELECT owner_id, title, content, embedding_status FROM notes WHERE id = 'legacy-note'").fetchone(), (owner, "Legacy note", "# Preserved", "missing"))
                self.assertEqual(connection.execute("SELECT owner_id, name FROM folders WHERE id = 'legacy-folder'").fetchone(), (owner, "Legacy"))
                self.assertEqual(connection.execute("SELECT version, name FROM schema_migrations").fetchall(), [(1, "001_initial.sql"), (2, "002_tenant_ownership.sql"), (3, "003_local_embeddings.sql"), (4, "004_note_versions.sql"), (5, "005_attachments.sql"), (6, "006_journal_entries.sql"), (7, "007_search_scopes.sql")])
                self.assertEqual(connection.execute("PRAGMA journal_mode").fetchone()[0], "wal")
                self.assertEqual(connection.execute("PRAGMA busy_timeout").fetchone()[0], 5_000)
                connection.execute("PRAGMA foreign_keys = ON")
                self.assertEqual(connection.execute("PRAGMA foreign_keys").fetchone()[0], 1)
                tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
                self.assertIn("generated_images", tables)
            finally:
                connection.close()

    def test_failed_migration_rolls_back_schema_and_version(self):
        with tempfile.TemporaryDirectory() as directory:
            database_path = Path(directory) / "rollback.db"
            migrations = Path(directory) / "migrations"
            migrations.mkdir()
            (migrations / "001_first.sql").write_text("CREATE TABLE stable (id INTEGER PRIMARY KEY);", encoding="utf-8")
            (migrations / "002_broken.sql").write_text("CREATE TABLE partial (id INTEGER); INVALID SQL;", encoding="utf-8")

            with self.assertRaises(sqlite3.OperationalError):
                apply_migrations(database_path, migrations)

            connection = sqlite3.connect(database_path)
            try:
                tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
                self.assertIn("stable", tables)
                self.assertNotIn("partial", tables)
                self.assertEqual(connection.execute("SELECT version FROM schema_migrations").fetchall(), [(1,)])
            finally:
                connection.close()


if __name__ == "__main__":
    unittest.main()
