"""F9 personas: saved chat instructions that may narrow what chat reads, never widen it."""

import asyncio
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

_TEMP_DIRECTORY = tempfile.TemporaryDirectory()
os.environ["MYOB_DATABASE_PATH"] = str(Path(_TEMP_DIRECTORY.name) / "personas.db")
os.environ["MYOB_DATA_DIR"] = _TEMP_DIRECTORY.name
os.environ["MERO_SERVICE_TOKEN"] = "test-internal-service-token-32-characters"

import app  # noqa: E402
from ai_service import AIAssistService  # noqa: E402
from database import Client, Note, Persona, Project, SessionLocal, engine  # noqa: E402

OWNER = "123e4567-e89b-42d3-a456-426614174000"


class PersonaTests(unittest.TestCase):
    @classmethod
    def tearDownClass(cls):
        engine.dispose()

    def setUp(self):
        self.db = SessionLocal(owner_id=OWNER)
        for model in (Note, Persona, Project, Client):
            self.db.query(model).delete()
        self.db.commit()
        self.db.add(Client(id="client-1", name="Acme"))
        self.db.add(Project(id="project-1", name="Harbour", client_id="client-1"))
        self.db.add(Note(id="work-1", title="Work", content="work body", tags=[], kind="entry", space="work", project_id="project-1"))
        self.db.add(Note(id="personal-1", title="Personal", content="personal body", tags=[], kind="entry", space="personal"))
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def make(self, **kwargs):
        payload = {"name": "Client update", "instructions": "Plain language, no internal detail."}
        payload.update(kwargs)
        return app.create_persona(app.PersonaWrite(**payload), self.db)

    def test_create_list_update_and_delete(self):
        created = self.make()
        self.assertEqual([p["id"] for p in app.list_personas(self.db)], [created["id"]])

        app.update_persona(created["id"], app.PersonaWrite(name="Renamed", instructions="New rules."), self.db)
        self.assertEqual(app.list_personas(self.db)[0]["name"], "Renamed")

        app.delete_persona(created["id"], self.db)
        self.assertEqual(app.list_personas(self.db), [])

    def test_duplicate_names_and_missing_ids_are_rejected(self):
        self.make()
        with self.assertRaises(app.HTTPException) as raised:
            self.make()
        self.assertEqual(raised.exception.status_code, 409)

        with self.assertRaises(app.HTTPException) as raised:
            app.delete_persona("no-such-persona", self.db)
        self.assertEqual(raised.exception.status_code, 404)

    def test_only_one_persona_can_be_the_default(self):
        first = self.make(is_default=True)
        second = self.make(name="Reflection", is_default=True)
        defaults = [persona["id"] for persona in app.list_personas(self.db) if persona["is_default"]]
        self.assertEqual(defaults, [second["id"]])
        self.assertNotIn(first["id"], defaults)

    def test_instructions_are_length_capped(self):
        from pydantic import ValidationError
        with self.assertRaises(ValidationError):
            app.PersonaWrite(name="Too long", instructions="x" * 10001)
        self.make(name="At the cap", instructions="x" * 10000)

    def test_a_persona_default_scope_narrows_the_filters(self):
        persona = self.make(default_scope={"space": "work"})
        resolved = app.resolve_chat_context(self.db, app.AIChatRequest(query="anything", persona_id=persona["id"]))
        self.assertEqual(resolved["applied"]["filters"]["space"], "work")
        self.assertEqual(resolved["allowed_note_ids"], ["work-1"])

    def test_a_persona_cannot_widen_a_filter_the_caller_set(self):
        persona = self.make(default_scope={"space": "personal", "project_id": "project-1"})
        request = app.AIChatRequest(query="anything", persona_id=persona["id"], filters={"space": "work"})
        resolved = app.resolve_chat_context(self.db, request)
        self.assertEqual(resolved["applied"]["filters"]["space"], "work")
        self.assertEqual(resolved["allowed_note_ids"], ["work-1"])

    def test_the_default_persona_applies_when_nothing_else_is_asked_for(self):
        persona = self.make(default_scope={"project_id": "project-1"}, is_default=True)
        resolved = app.resolve_chat_context(self.db, app.AIChatRequest(query="anything"))
        self.assertEqual(resolved["applied"]["persona_id"], persona["id"])
        self.assertEqual(resolved["applied"]["filters"]["project_id"], "project-1")

    def test_a_missing_persona_id_is_rejected(self):
        with self.assertRaises(app.HTTPException) as raised:
            app.resolve_chat_context(self.db, app.AIChatRequest(query="anything", persona_id="no-such-persona"))
        self.assertEqual(raised.exception.status_code, 404)

    def test_persona_instructions_reach_the_system_prompt(self):
        service = AIAssistService(self.db)
        captured = {}
        with patch.object(service, "_semantic_search", return_value=[]), \
             patch.object(service, "_build_context", return_value="CONTEXT"), \
             patch.object(service, "_extract_citations", return_value=[]), \
             patch.object(service, "_call_llm", side_effect=lambda prompt, messages: captured.setdefault("prompt", prompt) or "answer"):
            asyncio.run(service.answer_question("q", persona_instructions="Speak only in plain language."))
        self.assertIn("Speak only in plain language.", captured["prompt"])
        self.assertIn("CONTEXT", captured["prompt"])


if __name__ == "__main__":
    unittest.main()
