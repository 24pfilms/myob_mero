"""F2 search modes: text finds exact words, AI finds by meaning, and both report where they matched."""

import json
import os
import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch

_TEMP_DIRECTORY = tempfile.TemporaryDirectory()
os.environ["MYOB_DATABASE_PATH"] = str(Path(_TEMP_DIRECTORY.name) / "modes.db")
os.environ["MYOB_DATA_DIR"] = _TEMP_DIRECTORY.name
os.environ["MERO_SERVICE_TOKEN"] = "test-internal-service-token-32-characters"

import app  # noqa: E402
from database import Client, Note, NoteGroup, Project, SessionLocal, engine  # noqa: E402
from local_embeddings import MODEL_DIMENSIONS, MODEL_NAME  # noqa: E402
from search_filters import fts_query_string  # noqa: E402

OWNER = "123e4567-e89b-42d3-a456-426614174000"


def vector(value):
    return [value] * MODEL_DIMENSIONS


class SearchModeTests(unittest.TestCase):
    @classmethod
    def tearDownClass(cls):
        engine.dispose()

    def setUp(self):
        self.db = SessionLocal(owner_id=OWNER)
        for model in (Note, NoteGroup, Project, Client):
            self.db.query(model).delete()
        self.db.commit()

        self.db.add(Client(id="client-1", name="Acme"))
        self.db.add(Project(id="project-1", name="Harbour", client_id="client-1"))
        self.db.add(Note(
            id="exact", title="Pilings report", content="Line one\nThe quayside pilings were surveyed\nLine three",
            tags=[], kind="entry", entry_date=date(2026, 9, 21), space="work", project_id="project-1",
            embedding=json.dumps(vector(1.0)), embedding_model=MODEL_NAME,
            embedding_dimensions=MODEL_DIMENSIONS, embedding_status="ready",
        ))
        self.db.add(Note(
            id="meaning", title="Dock woodwork", content="Timber supports under the wharf",
            tags=[], kind="note", space="work",
            embedding=json.dumps(vector(0.99)), embedding_model=MODEL_NAME,
            embedding_dimensions=MODEL_DIMENSIONS, embedding_status="ready",
        ))
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def search(self, q, **kwargs):
        return app.semantic_search(q=q, db=self.db, **kwargs)

    def test_text_mode_finds_exact_words_only(self):
        results = self.search("pilings", mode="text")["results"]
        self.assertEqual([result["id"] for result in results], ["exact"])

        # "wharf" is in the other note's text, so text mode must not return the pilings note.
        self.assertEqual([r["id"] for r in self.search("wharf", mode="text")["results"]], ["meaning"])
        self.assertEqual(self.search("nonexistentword", mode="text")["results"], [])

    def test_ai_mode_returns_similar_notes_text_mode_misses(self):
        with patch("local_embeddings.get_local_embedding_provider") as provider:
            provider.return_value.embed_query.return_value = vector(1.0)
            ai_ids = {result["id"] for result in self.search("underwater structure", mode="ai")["results"]}
        self.assertEqual(ai_ids, {"exact", "meaning"})
        self.assertEqual(self.search("underwater structure", mode="text")["results"], [])

    def test_match_locations_point_at_the_matching_line(self):
        results = self.search("pilings", mode="text")["results"]
        body = [match for match in results[0]["matches"] if match["field"] == "body"]
        self.assertEqual(body[0]["line"], 1)
        self.assertEqual(body[0]["preview"], "The quayside pilings were surveyed")

        title_hit = self.search("Pilings report", mode="text")["results"][0]["matches"]
        self.assertEqual(title_hit[0]["field"], "title")

    def test_filter_options_count_only_the_current_results(self):
        options = self.search("pilings", mode="text")["filter_options"]
        self.assertEqual(options["space"], [{"value": "work", "count": 1}])
        self.assertEqual(options["kind"], [{"value": "entry", "count": 1}])
        self.assertEqual(options["project_id"], [{"value": "project-1", "count": 1, "name": "Harbour"}])
        self.assertEqual(options["client_id"], [{"value": "client-1", "count": 1, "name": "Acme"}])

    def test_filters_cut_the_set_before_scoring(self):
        self.assertEqual(self.search("pilings", mode="text", kind="note")["results"], [])
        self.assertEqual(self.search("pilings", mode="text", from_date=date(2026, 1, 1), to_date=date(2026, 1, 2))["results"], [])
        self.assertEqual(len(self.search("pilings", mode="text", client_id="client-1")["results"]), 1)

    def test_group_scope_limits_results_to_the_group(self):
        self.db.add(NoteGroup(id="docks", name="Just docks", mode="fixed", definition={"note_ids": ["meaning"]}))
        self.db.add(NoteGroup(id="reports", name="Just reports", mode="fixed", definition={"note_ids": ["exact"]}))
        self.db.commit()
        self.assertEqual([r["id"] for r in self.search("wharf", mode="text", group_id="docks")["results"]], ["meaning"])
        # The same query inside a group that excludes the matching note must return nothing.
        self.assertEqual(self.search("wharf", mode="text", group_id="reports")["results"], [])

        with self.assertRaises(app.HTTPException) as raised:
            self.search("wharf", mode="text", group_id="no-such-group")
        self.assertEqual(raised.exception.status_code, 404)

    def test_fts_syntax_in_a_query_is_quoted_not_executed(self):
        # Bare FTS5 operators would otherwise error or change the query's meaning.
        self.assertEqual(fts_query_string('pilings OR "x" NEAR(a b)'), '"pilings" "OR" "x" "NEAR" "a" "b"')
        for hostile in ['pilings"', "pilings*", "(pilings", "^pilings"]:
            self.assertEqual(self.search(hostile, mode="text")["results"][0]["id"], "exact", hostile)
        # Punctuation with no searchable word is an empty query, not an FTS5 syntax error.
        for empty in ['""', "***", "()"]:
            self.assertEqual(self.search(empty, mode="text")["results"], [], empty)

    def test_bulk_action_touches_only_the_listed_notes(self):
        app.bulk_update_notes(app.BulkAction(note_ids=["exact"], add_tags=["reviewed"], space="personal"), self.db)
        self.db.expire_all()
        changed = self.db.query(Note).filter(Note.id == "exact").one()
        untouched = self.db.query(Note).filter(Note.id == "meaning").one()
        self.assertEqual(changed.tags, ["reviewed"])
        self.assertEqual(changed.space, "personal")
        self.assertEqual(untouched.tags, [])
        self.assertEqual(untouched.space, "work")

    def test_bulk_assign_validates_the_project_and_marks_assignment_manual(self):
        with self.assertRaises(app.HTTPException) as raised:
            app.bulk_update_notes(app.BulkAction(note_ids=["exact"], project_id="does-not-exist"), self.db)
        self.assertEqual(raised.exception.status_code, 404)

        app.bulk_update_notes(app.BulkAction(note_ids=["meaning"], project_id="project-1"), self.db)
        self.db.expire_all()
        self.assertEqual(self.db.query(Note).filter(Note.id == "meaning").one().assignment, "manual")


if __name__ == "__main__":
    unittest.main()
