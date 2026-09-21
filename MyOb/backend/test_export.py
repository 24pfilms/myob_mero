import csv
import io
import tempfile
import unittest
import zipfile
from datetime import date, datetime
from pathlib import Path

import frontmatter
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base, Client, Note, Project, TenantSession
from journal_export import export_archive, sanitize_segment

OWNER = "123e4567-e89b-42d3-a456-426614174000"
HOSTILE_TITLES = ["../../escape", "..", "C:\\Windows\\system32\\evil", "CON", "nul.md", "sub/dir/name", "  ...  ", "\u0000null"]


class ExportTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.output = Path(self.temp.name) / "exports"
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.addCleanup(self.engine.dispose)
        self.session = sessionmaker(class_=TenantSession, bind=self.engine, autoflush=False)(owner_id=OWNER)
        self.addCleanup(self.session.close)

    def seed(self, titles=("Work entry", "Personal entry", "Plain note")):
        client = Client(id="client-1", name="Acme", archived=0, created_at=datetime.utcnow())
        project = Project(id="project-1", name="Redesign", client_id="client-1", status="active", created_at=datetime.utcnow())
        self.session.add_all([client, project])
        self.session.add(Note(id="note-1", title=titles[0], content="Body one", tags=["a"], kind="entry", entry_date=date(2026, 9, 21), space="work", project_id="project-1", word_count=2, created_at=datetime.utcnow(), updated_at=datetime.utcnow()))
        self.session.add(Note(id="note-2", title=titles[1], content="Body two", tags=[], kind="entry", entry_date=date(2026, 9, 20), space="personal", word_count=2, created_at=datetime.utcnow(), updated_at=datetime.utcnow()))
        self.session.add(Note(id="note-3", title=titles[2], content="Body three", tags=[], kind="note", space="work", word_count=2, created_at=datetime.utcnow(), updated_at=datetime.utcnow()))
        self.session.commit()

    def test_archive_holds_every_note_and_table_row_split_by_space(self):
        self.seed()
        archive_path = export_archive(self.session, self.output)
        with zipfile.ZipFile(archive_path) as archive:
            names = archive.namelist()
            markdown = [name for name in names if name.endswith(".md")]
            self.assertEqual(len(markdown), 3)
            self.assertIn("work/entries/2026/2026-09-21-Work entry.md", names)
            self.assertIn("personal/entries/2026/2026-09-20-Personal entry.md", names)
            self.assertIn("work/notes/Plain note.md", names)

            parsed = frontmatter.loads(archive.read("work/entries/2026/2026-09-21-Work entry.md").decode("utf-8"))
            self.assertEqual(parsed.content.strip(), "Body one")
            self.assertEqual(parsed["entry_date"], "2026-09-21")
            self.assertEqual(parsed["space"], "work")
            self.assertEqual(parsed["project_id"], "project-1")

            clients = list(csv.DictReader(io.StringIO(archive.read("tables/clients.csv").decode("utf-8"))))
            projects = list(csv.DictReader(io.StringIO(archive.read("tables/projects.csv").decode("utf-8"))))
            self.assertEqual([row["name"] for row in clients], ["Acme"])
            self.assertEqual([row["client_id"] for row in projects], ["client-1"])

    def test_hostile_titles_stay_inside_the_archive_and_never_collide(self):
        self.seed(titles=HOSTILE_TITLES[:3])
        for index, title in enumerate(HOSTILE_TITLES[3:], start=4):
            self.session.add(Note(id=f"note-{index}", title=title, content="x", tags=[], kind="note", space="work", created_at=datetime.utcnow(), updated_at=datetime.utcnow()))
        self.session.add(Note(id="note-dup", title=HOSTILE_TITLES[0], content="x", tags=[], kind="note", space="work", created_at=datetime.utcnow(), updated_at=datetime.utcnow()))
        self.session.commit()

        archive_path = export_archive(self.session, self.output)
        extract_root = (Path(self.temp.name) / "extracted").resolve()
        with zipfile.ZipFile(archive_path) as archive:
            names = archive.namelist()
            self.assertEqual(len(names), len(set(names)))
            for name in names:
                self.assertNotIn("..", name.split("/"))
                self.assertNotIn("\\", name)
                self.assertFalse(name.startswith("/"))
                self.assertLessEqual(len(Path(name).parts), 4)
                resolved = (extract_root / name).resolve()
                self.assertTrue(str(resolved).startswith(str(extract_root)))
            archive.extractall(extract_root)
        self.assertTrue(any(extract_root.rglob("*.md")))

    def test_sanitize_segment_rejects_traversal_and_reserved_names(self):
        self.assertEqual(sanitize_segment("..", "fallback"), "fallback")
        self.assertEqual(sanitize_segment("CON", "fallback"), "fallback")
        self.assertEqual(sanitize_segment("com1.txt", "fallback"), "fallback")
        self.assertEqual(sanitize_segment("", "fallback"), "fallback")
        self.assertEqual(sanitize_segment("a/b\\c", "fallback"), "a_b_c")
        self.assertEqual(sanitize_segment("x" * 200, "fallback"), "x" * 80)

    def test_progress_reaches_the_total(self):
        self.seed()
        seen = []
        export_archive(self.session, self.output, progress=lambda processed, total: seen.append((processed, total)))
        self.assertEqual(seen[-1], (5, 5))


if __name__ == "__main__":
    unittest.main()
