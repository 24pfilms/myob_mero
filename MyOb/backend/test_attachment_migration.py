import base64
import hashlib
import tempfile
import unittest
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from attachment_migration import migrate_note
from database import Attachment, Base, Note, NoteVersion

OWNER = "11111111-1111-4111-8111-111111111111"
PNG = b"\x89PNG\r\n\x1a\nseeded-pixels"
INLINE = f"Before ![proof](data:image/png;base64,{base64.b64encode(PNG).decode()}) after"


class AttachmentMigrationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.engine = create_engine(f"sqlite:///{self.root / 'notes.db'}")
        event.listen(self.engine, "connect", lambda connection, _: connection.execute("PRAGMA foreign_keys=ON"))
        Base.metadata.create_all(self.engine)
        self.session = sessionmaker(bind=self.engine)()

    def tearDown(self):
        self.session.close()
        self.engine.dispose()
        self.temp.cleanup()

    def seed(self, content=INLINE):
        note = Note(owner_id=OWNER, id="note-1", title="Proof", content=content, tags=[], current_version=1)
        self.session.add(note)
        self.session.add(NoteVersion(owner_id=OWNER, id="version-1", note_id=note.id, version=1, title=note.title, content=content, tags=[]))
        self.session.commit()
        return note

    def test_migrates_to_hashed_file_and_preserves_original_version(self):
        note = self.seed()
        count = migrate_note(self.session, note, self.root / "attachments")
        self.assertEqual(count, 1)
        self.assertNotIn("data:image", note.content)
        self.assertIn("attachment://", note.content)
        self.assertEqual(note.current_version, 2)
        attachment = self.session.query(Attachment).one()
        stored = self.root / "attachments" / attachment.storage_path
        self.assertEqual(stored.read_bytes(), PNG)
        self.assertEqual(attachment.sha256, hashlib.sha256(PNG).hexdigest())
        self.assertEqual(self.session.query(NoteVersion).filter(NoteVersion.version == 1).one().content, INLINE)
        self.assertEqual(migrate_note(self.session, note, self.root / "attachments"), 0)
        self.assertEqual(self.session.query(Attachment).count(), 1)

    def test_invalid_content_leaves_note_and_storage_unchanged(self):
        note = self.seed("![bad](data:image/png;base64,aGVsbG8=)")
        with self.assertRaisesRegex(ValueError, "does not match"):
            migrate_note(self.session, note, self.root / "attachments")
        self.session.rollback()
        self.assertIn("data:image", self.session.query(Note).one().content)
        self.assertEqual(self.session.query(Attachment).count(), 0)
        self.assertFalse((self.root / "attachments").exists())

    def test_durable_orphan_is_safe_to_resume_after_interrupted_transaction(self):
        note = self.seed()
        real_commit = self.session.commit
        self.session.commit = lambda: (_ for _ in ()).throw(RuntimeError("interrupted"))
        with self.assertRaisesRegex(RuntimeError, "interrupted"):
            migrate_note(self.session, note, self.root / "attachments")
        self.session.rollback()
        self.session.commit = real_commit
        self.assertEqual(self.session.query(Note).one().current_version, 1)
        self.assertEqual(len(list((self.root / "attachments").rglob("*.png"))), 1)
        self.assertEqual(migrate_note(self.session, self.session.query(Note).one(), self.root / "attachments"), 1)
        self.assertEqual(self.session.query(Attachment).count(), 1)


if __name__ == "__main__":
    unittest.main()
