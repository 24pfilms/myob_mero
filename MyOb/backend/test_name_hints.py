"""F1 assignment hints: plain-text name matching, and assign/undo through the API."""

import os
import tempfile
import unittest
from datetime import date
from pathlib import Path

_TEMP_DIRECTORY = tempfile.TemporaryDirectory()
os.environ["MYOB_DATABASE_PATH"] = str(Path(_TEMP_DIRECTORY.name) / "hints.db")
os.environ["MYOB_DATA_DIR"] = _TEMP_DIRECTORY.name
os.environ["MERO_SERVICE_TOKEN"] = "test-internal-service-token-32-characters"

import app  # noqa: E402
from database import Client, Note, Project, SessionLocal, engine  # noqa: E402
from journal import body_word_count, name_hints  # noqa: E402

OWNER = "123e4567-e89b-42d3-a456-426614174000"


class NameHintTests(unittest.TestCase):
    @classmethod
    def tearDownClass(cls):
        engine.dispose()

    def setUp(self):
        self.db = SessionLocal(owner_id=OWNER)
        for model in (Note, Project, Client):
            self.db.query(model).delete()
        self.db.commit()
        self.db.add(Client(id="acme", name="Acme", archived=0))
        self.db.add(Client(id="oldco", name="Oldco", archived=1))
        self.db.add(Project(id="harbour", name="Harbour", client_id="acme", status="active"))
        self.db.add(Project(id="done-project", name="Sunset", client_id="acme", status="done"))
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def entry(self, content, note_id="entry-1", project_id=None):
        note = Note(id=note_id, title="Entry", content=content, tags=[], kind="entry",
                    entry_date=date(2026, 9, 21), space="work", project_id=project_id)
        self.db.add(note)
        self.db.commit()
        return note

    def test_a_named_project_is_hinted_with_the_matching_line(self):
        note = self.entry("Line one\nSpent the day on Harbour pilings\nLine three")
        hints = name_hints(self.db, note)
        self.assertEqual([(hint["kind"], hint["id"]) for hint in hints], [("project", "harbour")])
        self.assertEqual(hints[0]["preview"], "Spent the day on Harbour pilings")

    def test_a_named_client_is_hinted_alongside_the_project(self):
        note = self.entry("Acme called about Harbour")
        hints = name_hints(self.db, note)
        self.assertEqual([(hint["kind"], hint["id"]) for hint in hints], [("project", "harbour"), ("client", "acme")])

    def test_matching_ignores_case_but_respects_word_boundaries(self):
        self.assertTrue(name_hints(self.db, self.entry("worked on harbour today")))
        # "Harbourside" is a different word and must not trigger the Harbour hint.
        self.assertEqual(name_hints(self.db, self.entry("Met at Harbourside cafe", note_id="entry-2")), [])

    def test_archived_clients_and_finished_projects_are_not_hinted(self):
        note = self.entry("Talked to Oldco about the Sunset project")
        self.assertEqual(name_hints(self.db, note), [])

    def test_the_project_already_assigned_is_not_hinted_again(self):
        note = self.entry("More Harbour work for Acme", project_id="harbour")
        # Harbour is already linked, so only the unlinked client name is worth offering.
        self.assertEqual([hint["kind"] for hint in name_hints(self.db, note)], ["client"])

    def test_an_empty_body_produces_no_hints(self):
        self.assertEqual(name_hints(self.db, self.entry("   \n  \n")), [])

    def test_word_count_ignores_frontmatter(self):
        self.assertEqual(body_word_count("---\ntitle: Ignored words here\n---\nthree words only"), 3)
        self.assertEqual(body_word_count("plain body text"), 3)
        self.assertEqual(body_word_count(""), 0)
        # Malformed frontmatter is still a body, so every word of it still counts.
        self.assertEqual(body_word_count("---\nnot: [valid\nbody text"), 5)

    def test_assign_returns_the_previous_values_so_undo_works(self):
        note = self.entry("Harbour work")
        assigned = app.update_entry_assignment(note.id, app.AssignmentWrite(space="work", project_id="harbour"), self.db)
        self.assertEqual(assigned["project_id"], "harbour")
        self.assertEqual(assigned["assignment"], "manual")
        self.assertEqual(assigned["previous"], {"space": "work", "project_id": None, "assignment": "manual"})

        undone = app.update_entry_assignment(
            note.id, app.AssignmentWrite(space=assigned["previous"]["space"], project_id=assigned["previous"]["project_id"]), self.db)
        self.assertIsNone(undone["project_id"])

    def test_assigning_an_unknown_project_is_refused(self):
        note = self.entry("Harbour work")
        with self.assertRaises(app.HTTPException) as raised:
            app.update_entry_assignment(note.id, app.AssignmentWrite(space="work", project_id="no-such-project"), self.db)
        self.assertEqual(raised.exception.status_code, 404)

    def test_unlinked_lists_entries_that_name_a_project_without_being_linked(self):
        self.entry("Harbour pilings survey", note_id="mentions")
        self.entry("Harbour work already linked", note_id="linked", project_id="harbour")
        self.entry("Nothing relevant here", note_id="unrelated")
        unlinked = app.project_unlinked_entries("harbour", db=self.db)
        self.assertEqual([row["id"] for row in unlinked], ["mentions"])
        self.assertEqual(unlinked[0]["preview"], "Harbour pilings survey")


if __name__ == "__main__":
    unittest.main()
