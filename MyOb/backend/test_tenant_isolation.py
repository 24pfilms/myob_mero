import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import AISettings, Base, Note, TenantSession

OWNER_A = "123e4567-e89b-42d3-a456-426614174000"
OWNER_B = "123e4567-e89b-42d3-a456-426614174001"


class TenantIsolationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(cls.engine)
        cls.sessions = sessionmaker(class_=TenantSession, bind=cls.engine, autoflush=False)

    @classmethod
    def tearDownClass(cls):
        cls.engine.dispose()

    def test_same_logical_ids_are_isolated_and_writes_receive_owner(self):
        first = self.sessions(owner_id=OWNER_A)
        second = self.sessions(owner_id=OWNER_B)
        try:
            first.add(Note(id="shared", title="First", content="A", tags=[]))
            first.add(AISettings(id="default"))
            first.commit()
            second.add(Note(id="shared", title="Second", content="B", tags=[]))
            second.add(AISettings(id="default"))
            second.commit()

            self.assertEqual([(note.owner_id, note.title) for note in first.query(Note).all()], [(OWNER_A, "First")])
            self.assertEqual([(note.owner_id, note.title) for note in second.query(Note).all()], [(OWNER_B, "Second")])
            self.assertEqual(first.query(AISettings).count(), 1)
            self.assertEqual(second.query(AISettings).count(), 1)
        finally:
            first.close()
            second.close()

    def test_cross_tenant_write_and_unscoped_query_fail_closed(self):
        session = self.sessions(owner_id=OWNER_A)
        try:
            session.add(Note(owner_id=OWNER_B, id="forged", title="Forged", content="No", tags=[]))
            with self.assertRaisesRegex(RuntimeError, "Cross-tenant"):
                session.commit()
            session.rollback()
        finally:
            session.close()

        unscoped = self.sessions()
        try:
            with self.assertRaisesRegex(RuntimeError, "Tenant owner is required"):
                unscoped.query(Note).all()
        finally:
            unscoped.close()


if __name__ == "__main__":
    unittest.main()
