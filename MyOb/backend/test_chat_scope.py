"""F9 scopes and F2 date phrases: chat may only read inside the scope it was given."""

import asyncio
import json
import os
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path
from unittest.mock import patch

_TEMP_DIRECTORY = tempfile.TemporaryDirectory()
os.environ["MYOB_DATABASE_PATH"] = str(Path(_TEMP_DIRECTORY.name) / "scope.db")
os.environ["MYOB_DATA_DIR"] = _TEMP_DIRECTORY.name
os.environ["MERO_SERVICE_TOKEN"] = "test-internal-service-token-32-characters"

import app  # noqa: E402
from ai_service import AIAssistService  # noqa: E402
from database import Client, Folder, Note, NoteGroup, Project, SessionLocal, engine  # noqa: E402
from local_embeddings import MODEL_DIMENSIONS  # noqa: E402
from search_filters import find_date_phrase, parse_date_phrase, week_start  # noqa: E402

OWNER = "123e4567-e89b-42d3-a456-426614174000"
TODAY = date(2026, 9, 21)  # a Monday


class DatePhraseTests(unittest.TestCase):
    def test_plain_phrases_become_ranges(self):
        self.assertEqual(parse_date_phrase("today", TODAY), (TODAY, TODAY))
        self.assertEqual(parse_date_phrase("yesterday", TODAY), (date(2026, 9, 20), date(2026, 9, 20)))
        self.assertEqual(parse_date_phrase("last week", TODAY), (date(2026, 9, 14), date(2026, 9, 20)))
        self.assertEqual(parse_date_phrase("this week", TODAY), (TODAY, date(2026, 9, 27)))
        self.assertEqual(parse_date_phrase("last month", TODAY), (date(2026, 8, 1), date(2026, 8, 31)))
        self.assertEqual(parse_date_phrase("in August", TODAY), (date(2026, 8, 1), date(2026, 8, 31)))
        self.assertEqual(parse_date_phrase("in August 2024", TODAY), (date(2024, 8, 1), date(2024, 8, 31)))
        self.assertEqual(parse_date_phrase("last year", TODAY), (date(2025, 1, 1), date(2025, 12, 31)))
        self.assertEqual(parse_date_phrase("the last 7 days", TODAY), (date(2026, 9, 15), TODAY))

    def test_a_future_month_name_means_last_year(self):
        self.assertEqual(parse_date_phrase("in December", TODAY), (date(2025, 12, 1), date(2025, 12, 31)))

    def test_unknown_phrases_are_ignored_rather_than_guessed(self):
        for phrase in ("", "sometime", "in Blursday", "last fortnight", "when I felt like it"):
            self.assertIsNone(parse_date_phrase(phrase, TODAY))

    def test_a_phrase_is_found_inside_a_whole_question(self):
        found = find_date_phrase("What did I do for Acme last month?", TODAY)
        self.assertEqual(found, ((date(2026, 8, 1), date(2026, 8, 31)), "last month"))
        self.assertIsNone(find_date_phrase("What did I do for Acme?", TODAY))

    def test_week_starts_on_monday(self):
        self.assertEqual(week_start(date(2026, 9, 27)), date(2026, 9, 21))
        self.assertEqual(week_start(date(2026, 9, 21)), date(2026, 9, 21))


class ChatScopeTests(unittest.TestCase):
    @classmethod
    def tearDownClass(cls):
        engine.dispose()

    def setUp(self):
        self.db = SessionLocal(owner_id=OWNER)
        for model in (Note, NoteGroup, Project, Client, Folder):
            self.db.query(model).delete()
        self.db.commit()

        self.db.add(Client(id="client-1", name="Acme"))
        self.db.add(Project(id="project-1", name="Harbour", client_id="client-1"))
        self.db.add(Folder(id="folder-1", name="Research"))
        for note_id, title, folder, tags, project in [
            ("in-1", "Inside one", "folder-1", ["review"], "project-1"),
            ("in-2", "Inside two", "folder-1", ["review"], None),
            ("out-1", "Outside", None, ["other"], None),
        ]:
            self.db.add(Note(
                id=note_id, title=title, content=f"{title} body", tags=tags, kind="entry",
                entry_date=TODAY, space="work", folder_id=folder, project_id=project,
                embedding=json.dumps([1.0] * MODEL_DIMENSIONS), embedding_status="ready",
            ))
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def resolve(self, **kwargs):
        return app.resolve_chat_context(self.db, app.AIChatRequest(query=kwargs.pop("query", "what happened"), **kwargs))

    def test_no_scope_and_no_filters_reads_the_whole_vault(self):
        resolved = app.resolve_chat_context(self.db, app.AIChatRequest(query="what happened", filters={"space": None}))
        self.assertEqual(resolved["applied"]["filters"]["space"], "work")
        self.assertEqual(sorted(resolved["allowed_note_ids"]), ["in-1", "in-2", "out-1"])

    def test_scope_by_note_ids_folder_tags_project_and_client(self):
        self.assertEqual(sorted(self.resolve(scope={"note_ids": ["in-1", "in-2"]})["allowed_note_ids"]), ["in-1", "in-2"])
        self.assertEqual(sorted(self.resolve(scope={"folder_id": "folder-1"})["allowed_note_ids"]), ["in-1", "in-2"])
        self.assertEqual(sorted(self.resolve(scope={"tags": ["review"]})["allowed_note_ids"]), ["in-1", "in-2"])
        self.assertEqual(self.resolve(scope={"project_id": "project-1"})["allowed_note_ids"], ["in-1"])
        self.assertEqual(self.resolve(scope={"client_id": "client-1"})["allowed_note_ids"], ["in-1"])

    def test_unknown_note_ids_in_a_scope_are_dropped_not_trusted(self):
        resolved = self.resolve(scope={"note_ids": ["in-1", "does-not-exist"]})
        self.assertEqual(resolved["allowed_note_ids"], ["in-1"])

    def test_a_fixed_group_resolves_to_its_saved_ids_and_a_live_group_re_runs(self):
        self.db.add(NoteGroup(id="fixed-1", name="Fixed", mode="fixed", definition={"note_ids": ["in-1"]}))
        self.db.add(NoteGroup(id="live-1", name="Live", mode="live", definition={"folder_id": "folder-1"}))
        self.db.commit()
        self.assertEqual(self.resolve(scope={"group_id": "fixed-1"})["allowed_note_ids"], ["in-1"])
        self.assertEqual(sorted(self.resolve(scope={"group_id": "live-1"})["allowed_note_ids"]), ["in-1", "in-2"])

        # A live group picks up a new note that matches it; a fixed group does not.
        self.db.add(Note(id="in-3", title="Inside three", content="body", tags=[], kind="entry",
                         entry_date=TODAY, space="work", folder_id="folder-1"))
        self.db.commit()
        self.assertEqual(sorted(self.resolve(scope={"group_id": "live-1"})["allowed_note_ids"]), ["in-1", "in-2", "in-3"])
        self.assertEqual(self.resolve(scope={"group_id": "fixed-1"})["allowed_note_ids"], ["in-1"])

    def test_a_missing_group_is_rejected(self):
        with self.assertRaises(app.HTTPException) as raised:
            self.resolve(scope={"group_id": "no-such-group"})
        self.assertEqual(raised.exception.status_code, 404)

    def test_scope_and_filters_combine(self):
        self.db.query(Note).filter(Note.id == "in-2").one().entry_date = TODAY - timedelta(days=60)
        self.db.commit()
        resolved = self.resolve(scope={"folder_id": "folder-1"}, filters={"from": TODAY.isoformat()})
        self.assertEqual(resolved["allowed_note_ids"], ["in-1"])

    def test_a_date_phrase_in_the_question_sets_the_range(self):
        with patch("app.datetime") as clock:
            clock.utcnow.return_value.date.return_value = TODAY
            resolved = self.resolve(query="What did I do last week?")
        self.assertEqual(resolved["applied"]["date_phrase"], "last week")
        self.assertEqual(resolved["applied"]["filters"]["from"], "2026-09-14")
        self.assertEqual(resolved["applied"]["filters"]["to"], "2026-09-20")

    def test_an_explicit_range_beats_a_phrase_in_the_text(self):
        resolved = self.resolve(query="What did I do last week?", filters={"from": "2026-01-01", "to": "2026-01-31"})
        self.assertIsNone(resolved["applied"]["date_phrase"])
        self.assertEqual(resolved["applied"]["filters"]["from"], "2026-01-01")

    def test_the_service_never_searches_outside_the_allowed_ids(self):
        service = AIAssistService(self.db)
        with patch("ai.get_embedding", return_value=[1.0] * MODEL_DIMENSIONS):
            found = service._semantic_search("anything", limit=10, allowed_note_ids=["in-1"])
        self.assertEqual([note["id"] for note in found], ["in-1"])

        with patch("ai.get_embedding", return_value=[1.0] * MODEL_DIMENSIONS):
            self.assertEqual(service._semantic_search("anything", limit=10, allowed_note_ids=[]), [])

    def test_the_open_note_is_dropped_from_context_when_it_is_outside_the_scope(self):
        service = AIAssistService(self.db)
        captured = {}

        def fake_context(relevant_notes, current_note_id=None):
            captured["current_note_id"] = current_note_id
            return "context"

        with patch.object(service, "_semantic_search", return_value=[]), \
             patch.object(service, "_build_context", side_effect=fake_context), \
             patch.object(service, "_call_llm", return_value="answer"), \
             patch.object(service, "_extract_citations", return_value=[]):
            asyncio.run(service.answer_question("q", current_note_id="out-1", allowed_note_ids=["in-1"]))
        self.assertIsNone(captured["current_note_id"])

        with patch.object(service, "_semantic_search", return_value=[]), \
             patch.object(service, "_build_context", side_effect=fake_context), \
             patch.object(service, "_call_llm", return_value="answer"), \
             patch.object(service, "_extract_citations", return_value=[]):
            asyncio.run(service.answer_question("q", current_note_id="in-1", allowed_note_ids=["in-1"]))
        self.assertEqual(captured["current_note_id"], "in-1")


if __name__ == "__main__":
    unittest.main()
