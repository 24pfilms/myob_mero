"""F1/F2 entry listing filters: date range, space, project, client and assignment."""

import os
import tempfile
import unittest
from datetime import date
from pathlib import Path

_TEMP_DIRECTORY = tempfile.TemporaryDirectory()
os.environ["MYOB_DATABASE_PATH"] = str(Path(_TEMP_DIRECTORY.name) / "filters.db")
os.environ["MYOB_DATA_DIR"] = _TEMP_DIRECTORY.name
os.environ["MERO_SERVICE_TOKEN"] = "test-internal-service-token-32-characters"

import app  # noqa: E402
from database import Client, Note, Project, SessionLocal, engine  # noqa: E402

OWNER = "123e4567-e89b-42d3-a456-426614174000"


class EntryFilterTests(unittest.TestCase):
    @classmethod
    def tearDownClass(cls):
        engine.dispose()

    def setUp(self):
        self.db = SessionLocal(owner_id=OWNER)
        for model in (Note, Project, Client):
            self.db.query(model).delete()
        self.db.commit()

        self.db.add_all([
            Client(id="acme", name="Acme"),
            Client(id="globex", name="Globex"),
            Project(id="harbour", name="Harbour", client_id="acme"),
            Project(id="tower", name="Tower", client_id="globex"),
        ])
        self.db.add_all([
            Note(id="aug", title="August work", content="body", tags=[], kind="entry",
                 entry_date=date(2026, 8, 15), space="work", project_id="harbour", assignment="manual"),
            Note(id="sep", title="September work", content="body", tags=[], kind="entry",
                 entry_date=date(2026, 9, 15), space="work", project_id="tower", assignment="rule"),
            Note(id="personal", title="September personal", content="body", tags=[], kind="entry",
                 entry_date=date(2026, 9, 16), space="personal", assignment="unassigned"),
            Note(id="plain", title="Not an entry", content="body", tags=[], kind="note", space="work"),
        ])
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def ids(self, **kwargs):
        return sorted(entry["id"] for entry in app.list_entries(db=self.db, **kwargs))

    def test_plain_notes_never_appear_in_the_entry_list(self):
        self.assertNotIn("plain", self.ids())
        self.assertEqual(self.ids(), ["aug", "personal", "sep"])

    def test_date_range_is_inclusive_at_both_ends(self):
        self.assertEqual(self.ids(from_date=date(2026, 8, 15), to_date=date(2026, 8, 15)), ["aug"])
        self.assertEqual(self.ids(from_date=date(2026, 9, 1)), ["personal", "sep"])
        self.assertEqual(self.ids(to_date=date(2026, 8, 31)), ["aug"])
        self.assertEqual(self.ids(from_date=date(2027, 1, 1)), [])

    def test_space_project_client_and_assignment_filters(self):
        self.assertEqual(self.ids(space="work"), ["aug", "sep"])
        self.assertEqual(self.ids(space="personal"), ["personal"])
        self.assertEqual(self.ids(project_id="harbour"), ["aug"])
        self.assertEqual(self.ids(client_id="acme"), ["aug"])
        self.assertEqual(self.ids(client_id="globex"), ["sep"])
        self.assertEqual(self.ids(assignment="rule"), ["sep"])
        self.assertEqual(self.ids(assignment="unassigned"), ["personal"])

    def test_filters_combine_rather_than_replace(self):
        self.assertEqual(self.ids(space="work", from_date=date(2026, 9, 1)), ["sep"])
        self.assertEqual(self.ids(space="personal", client_id="acme"), [])

    def test_results_are_newest_first_and_limited(self):
        ordered = [entry["id"] for entry in app.list_entries(db=self.db)]
        self.assertEqual(ordered[0], "personal")
        self.assertEqual(len(app.list_entries(db=self.db, limit=1)), 1)

    def test_a_silly_limit_is_refused(self):
        for limit in (0, -1, 501):
            with self.assertRaises(app.HTTPException) as raised:
                app.list_entries(db=self.db, limit=limit)
            self.assertEqual(raised.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
