"""The most important journal test: personal rows must never reach a work-scoped output.

Covers search, chat scope resolution, personas and export, since each is a separate
path that could leak. A failure here is a privacy bug, not a cosmetic one.
"""

import os
import tempfile
import unittest
from datetime import date
from pathlib import Path

_TEMP_DIRECTORY = tempfile.TemporaryDirectory()
os.environ["MYOB_DATABASE_PATH"] = str(Path(_TEMP_DIRECTORY.name) / "space.db")
os.environ["MYOB_DATA_DIR"] = _TEMP_DIRECTORY.name
os.environ["MERO_SERVICE_TOKEN"] = "test-internal-service-token-32-characters"

import app  # noqa: E402
from database import Client, Note, Persona, Project, SessionLocal, engine  # noqa: E402

OWNER = "123e4567-e89b-42d3-a456-426614174000"
SECRET = "hypochondria"


class SpaceIsolationTests(unittest.TestCase):
    @classmethod
    def tearDownClass(cls):
        engine.dispose()

    def setUp(self):
        self.db = SessionLocal(owner_id=OWNER)
        for model in (Note, Project, Client, Persona):
            self.db.query(model).delete()
        self.db.commit()

        self.db.add(Client(id="client-1", name="Acme"))
        self.db.add(Project(id="project-1", name="Harbour", client_id="client-1"))
        self.db.add(Note(
            id="work-1", title="Harbour survey", content="Reviewed the Harbour pilings", tags=[],
            kind="entry", entry_date=date(2026, 9, 21), space="work", project_id="project-1",
        ))
        self.db.add(Note(
            id="personal-1", title="Harbour swim", content=f"Harbour swim and my {SECRET}", tags=[],
            kind="entry", entry_date=date(2026, 9, 21), space="personal",
        ))
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def search(self, **kwargs):
        params = {"q": "Harbour", "mode": "text", "db": self.db}
        params.update(kwargs)
        return app.semantic_search(**params)

    def test_work_filtered_search_never_returns_a_personal_row(self):
        titles = [result["id"] for result in self.search(space="work")["results"]]
        self.assertEqual(titles, ["work-1"])

        every = self.search()["results"]
        self.assertEqual({result["id"] for result in every}, {"work-1", "personal-1"})

    def test_client_and_project_filters_cannot_reach_personal_rows(self):
        # A personal entry has no project, so it can never join through to a client.
        self.assertEqual([r["id"] for r in self.search(client_id="client-1")["results"]], ["work-1"])
        self.assertEqual([r["id"] for r in self.search(project_id="project-1")["results"]], ["work-1"])

    def test_no_personal_text_appears_in_a_work_scoped_result_payload(self):
        payload = repr(self.search(space="work"))
        self.assertNotIn(SECRET, payload)
        self.assertNotIn("personal-1", payload)

    def test_chat_defaults_to_work_and_excludes_personal(self):
        resolved = app.resolve_chat_context(self.db, app.AIChatRequest(query="What happened at the Harbour?"))
        self.assertEqual(resolved["applied"]["filters"]["space"], "work")
        self.assertEqual(resolved["allowed_note_ids"], ["work-1"])

    def test_chat_includes_personal_only_when_asked_for_explicitly(self):
        request = app.AIChatRequest(query="Harbour", filters={"space": "personal"})
        resolved = app.resolve_chat_context(self.db, request)
        self.assertEqual(resolved["allowed_note_ids"], ["personal-1"])

    def test_hand_picked_scope_may_include_personal_because_the_choice_was_explicit(self):
        request = app.AIChatRequest(query="Harbour", scope={"note_ids": ["work-1", "personal-1"]})
        resolved = app.resolve_chat_context(self.db, request)
        self.assertEqual(sorted(resolved["allowed_note_ids"]), ["personal-1", "work-1"])
        self.assertTrue(resolved["applied"]["hand_picked"])
        self.assertIsNone(resolved["applied"]["filters"]["space"])

    def test_a_work_persona_cannot_be_widened_to_personal_by_its_own_scope(self):
        self.db.add(Persona(
            id="persona-1", name="Client update", instructions="Plain language only.",
            default_scope={"space": "personal"}, is_default=0,
        ))
        self.db.commit()
        # The caller asked for work; the persona's personal default must not override it.
        request = app.AIChatRequest(query="Harbour", persona_id="persona-1", filters={"space": "work"})
        resolved = app.resolve_chat_context(self.db, request)
        self.assertEqual(resolved["applied"]["filters"]["space"], "work")
        self.assertEqual(resolved["allowed_note_ids"], ["work-1"])

    def test_export_keeps_work_and_personal_in_separate_folders(self):
        import zipfile

        from journal_export import export_archive

        archive_path = export_archive(self.db, Path(_TEMP_DIRECTORY.name) / "space-export")
        with zipfile.ZipFile(archive_path) as archive:
            work = [name for name in archive.namelist() if name.startswith("work/")]
            personal = [name for name in archive.namelist() if name.startswith("personal/")]
            self.assertEqual(len(work), 1)
            self.assertEqual(len(personal), 1)
            self.assertNotIn(SECRET, archive.read(work[0]).decode("utf-8"))


if __name__ == "__main__":
    unittest.main()
