import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

_TEMP_DIRECTORY = tempfile.TemporaryDirectory()
os.environ["MYOB_DATABASE_PATH"] = str(Path(_TEMP_DIRECTORY.name) / "versions.db")
os.environ["MERO_SERVICE_TOKEN"] = "test-internal-service-token-32-characters"

import app  # noqa: E402
from database import Note, NoteVersion, SessionLocal, engine  # noqa: E402
from local_embeddings import MODEL_DIMENSIONS, MODEL_NAME  # noqa: E402
from security import RequestContext, run_with_request_context  # noqa: E402

OWNER = "123e4567-e89b-42d3-a456-426614174000"
FIELDS = {
    "embedding": json.dumps([0.1] * MODEL_DIMENSIONS), "embedding_model": MODEL_NAME,
    "embedding_dimensions": MODEL_DIMENSIONS, "embedding_status": "ready", "embedding_error": None,
}


class NoopThread:
    def __init__(self, *args, **kwargs):
        pass

    def start(self):
        pass


class NoteVersionTests(unittest.TestCase):
    @classmethod
    def tearDownClass(cls):
        engine.dispose()
        _TEMP_DIRECTORY.cleanup()

    def setUp(self):
        self.db = SessionLocal(owner_id=OWNER)
        self.db.query(NoteVersion).delete()
        self.db.query(Note).delete()
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_create_update_conflict_and_restore_keep_atomic_history(self):
        with patch.object(app, "embedding_fields", return_value=FIELDS):
            created = app.create_note(app.NoteCreate(title="First", content="Body one", tags=["one"]), self.db)
        note_id = created["id"]
        self.assertEqual(created["version"], 1)
        self.assertEqual(self.db.query(NoteVersion).filter(NoteVersion.note_id == note_id).count(), 1)

        context = RequestContext(OWNER, "version-test", None)
        with patch.object(app.threading, "Thread", NoopThread):
            updated = []
            run_with_request_context(context, lambda: updated.append(app.update_note(
                note_id, app.NoteUpdate(title="Second", content="Body two", version=1), self.db
            )))
        self.assertEqual(updated[0]["version"], 2)
        self.assertEqual(self.db.query(NoteVersion).filter(NoteVersion.note_id == note_id).count(), 2)

        with self.assertRaises(app.HTTPException) as conflict:
            app.update_note(note_id, app.NoteUpdate(title="Stale", version=1), self.db)
        self.assertEqual(conflict.exception.status_code, 409)
        self.db.rollback()

        with patch.object(app, "embedding_fields", return_value=FIELDS):
            restored = app.restore_note_version(note_id, 1, self.db)
        self.assertEqual(restored["title"], "First")
        self.assertEqual(restored["version"], 3)
        versions = self.db.query(NoteVersion).filter(NoteVersion.note_id == note_id).order_by(NoteVersion.version).all()
        self.assertEqual([item.version for item in versions], [1, 2, 3])
        self.assertEqual(versions[-1].content, "Body one")


if __name__ == "__main__":
    unittest.main()
