import os
import tempfile
import unittest
from pathlib import Path

_TEMP_DIRECTORY = tempfile.TemporaryDirectory()
os.environ["MYOB_DATABASE_PATH"] = str(Path(_TEMP_DIRECTORY.name) / "runtime.db")

from database import engine  # noqa: E402


class DatabaseRuntimeTests(unittest.TestCase):
    @classmethod
    def tearDownClass(cls):
        engine.dispose()
        _TEMP_DIRECTORY.cleanup()

    def test_every_sqlalchemy_connection_enables_sqlite_safety_pragmas(self):
        with engine.connect() as connection:
            self.assertEqual(connection.exec_driver_sql("PRAGMA journal_mode").scalar_one(), "wal")
            self.assertEqual(connection.exec_driver_sql("PRAGMA busy_timeout").scalar_one(), 5_000)
            self.assertEqual(connection.exec_driver_sql("PRAGMA foreign_keys").scalar_one(), 1)


if __name__ == "__main__":
    unittest.main()
