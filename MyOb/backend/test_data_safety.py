import sqlite3
import tempfile
import unittest
from pathlib import Path

from data_safety import create_backup, preflight_migration, restore_backup


class DataSafetyTests(unittest.TestCase):
    def test_online_backup_restores_seeded_database_and_attachments_separately(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            live = root / "live"
            attachments = live / "attachments"
            attachments.mkdir(parents=True)
            (attachments / "proof.txt").write_text("attachment-before-backup", encoding="utf-8")
            database_path = live / "notes.db"
            database = sqlite3.connect(database_path)
            database.executescript("CREATE TABLE notes (id TEXT PRIMARY KEY, content TEXT NOT NULL); INSERT INTO notes VALUES ('note-1', 'before-backup');")
            database.commit()

            backup_directory, manifest = create_backup(database_path, attachments, root / "backups")
            database.execute("UPDATE notes SET content = 'after-backup' WHERE id = 'note-1'")
            database.commit()
            (attachments / "proof.txt").write_text("attachment-after-backup", encoding="utf-8")
            database.close()

            restore_target, elapsed_ms = restore_backup(backup_directory, root / "verified-restore")
            self.assertGreaterEqual(elapsed_ms, 0)
            restored = sqlite3.connect(restore_target / "notes.db")
            try:
                self.assertEqual(restored.execute("SELECT content FROM notes WHERE id = 'note-1'").fetchone(), ("before-backup",))
            finally:
                restored.close()
            self.assertEqual((restore_target / "attachments" / "proof.txt").read_text(encoding="utf-8"), "attachment-before-backup")
            self.assertEqual(manifest["database"]["counts"]["notes"], 1)
            self.assertEqual(len(manifest["attachments"]), 1)

    def test_migration_preflight_operates_on_verified_restore_not_live_database(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            live = root / "live"
            live.mkdir()
            database_path = live / "notes.db"
            database = sqlite3.connect(database_path)
            fixture = Path(__file__).with_name("test_fixtures") / "legacy_database.sql"
            database.executescript(fixture.read_text(encoding="utf-8"))
            database.close()

            result = preflight_migration(
                database_path,
                live / "attachments",
                root / "backups",
                root / "migration-copy",
                "123e4567-e89b-42d3-a456-426614174000",
            )
            self.assertEqual(result["appliedMigrations"], [1, 2, 3, 4, 5, 6, 7])
            self.assertEqual(result["counts"]["notes"], 1)
            self.assertEqual(result["counts"]["folders"], 1)
            self.assertGreaterEqual(result["elapsedMs"], 0)
            original = sqlite3.connect(database_path)
            try:
                self.assertIsNone(original.execute("SELECT name FROM sqlite_schema WHERE name = 'schema_migrations'").fetchone())
            finally:
                original.close()

    def test_backup_refuses_output_inside_live_database_directory(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            database_path = root / "notes.db"
            database = sqlite3.connect(database_path)
            database.execute("CREATE TABLE proof (id INTEGER PRIMARY KEY)")
            database.close()
            with self.assertRaisesRegex(ValueError, "outside the live database directory"):
                create_backup(database_path, root / "attachments", root / "backups")


if __name__ == "__main__":
    unittest.main()
