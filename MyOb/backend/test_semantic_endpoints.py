import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

_TEMP_DIRECTORY = tempfile.TemporaryDirectory()
os.environ["MYOB_DATABASE_PATH"] = str(Path(_TEMP_DIRECTORY.name) / "semantic.db")
os.environ["MERO_SERVICE_TOKEN"] = "test-internal-service-token-32-characters"

import app  # noqa: E402
from database import EmbeddingJob, Note, SessionLocal, engine  # noqa: E402
from local_embeddings import MODEL_DIMENSIONS, MODEL_NAME  # noqa: E402

OWNER = "123e4567-e89b-42d3-a456-426614174000"


def vector(value):
    return [value] * MODEL_DIMENSIONS


class SemanticEndpointTests(unittest.TestCase):
    @classmethod
    def tearDownClass(cls):
        engine.dispose()
        _TEMP_DIRECTORY.cleanup()

    def setUp(self):
        self.db = SessionLocal(owner_id=OWNER)
        self.db.query(EmbeddingJob).delete()
        self.db.query(Note).delete()
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def add_ready_note(self, note_id, title, values):
        self.db.add(Note(
            id=note_id, title=title, content=title, tags=[], embedding=json.dumps(values),
            embedding_model=MODEL_NAME, embedding_dimensions=MODEL_DIMENSIONS, embedding_status="ready",
        ))
        self.db.commit()

    def test_similar_and_matrix_use_one_model_and_deduplicate_ids(self):
        self.add_ready_note("a", "A", vector(1.0))
        self.add_ready_note("b", "B", vector(1.0))
        similar = app.get_similar_notes("a", 5, self.db)
        self.assertEqual(similar["results"][0]["id"], "b")
        self.assertAlmostEqual(similar["results"][0]["score"], 1.0)

        matrix = app.similarity_matrix(app.SimilarityMatrixRequest(note_ids=["a", "b", "a"]), self.db)
        self.assertEqual(matrix["ids"], ["a", "b"])
        self.assertEqual(len(matrix["matrix"]), 2)
        self.assertEqual(matrix["dimensions"], MODEL_DIMENSIONS)

    def test_mixed_dimensions_are_rejected(self):
        self.add_ready_note("a", "A", vector(1.0))
        self.db.add(Note(
            id="bad", title="Bad", content="Bad", tags=[], embedding=json.dumps([1.0, 2.0]),
            embedding_model=MODEL_NAME, embedding_dimensions=2, embedding_status="ready",
        ))
        self.db.commit()
        with self.assertRaises(app.HTTPException) as raised:
            app.similarity_matrix(app.SimilarityMatrixRequest(note_ids=["a", "bad"]), self.db)
        self.assertEqual(raised.exception.status_code, 409)

    def test_embedding_job_checkpoints_and_completes(self):
        self.db.add_all([
            Note(id="a", title="A", content="A", tags=[]),
            Note(id="b", title="B", content="B", tags=[]),
            EmbeddingJob(id="job", status="pending", model=MODEL_NAME, dimensions=MODEL_DIMENSIONS, failures=[]),
        ])
        self.db.commit()
        fields = {
            "embedding": json.dumps(vector(0.5)), "embedding_model": MODEL_NAME,
            "embedding_dimensions": MODEL_DIMENSIONS, "embedding_status": "ready", "embedding_error": None,
        }
        with patch.object(app, "embedding_fields", return_value=fields):
            app.run_embedding_job(OWNER, "job")
        self.db.expire_all()
        job = self.db.query(EmbeddingJob).filter(EmbeddingJob.id == "job").first()
        self.assertEqual(job.status, "completed")
        self.assertEqual(job.processed_count, 2)
        self.assertEqual(job.last_note_id, "b")
        self.assertEqual(self.db.query(Note).filter(Note.embedding_status == "ready").count(), 2)


if __name__ == "__main__":
    unittest.main()
