import os
import tempfile
import unittest
from pathlib import Path

_TEMP_DIRECTORY = tempfile.TemporaryDirectory()
os.environ["MYOB_DATABASE_PATH"] = str(Path(_TEMP_DIRECTORY.name) / "routes.db")
os.environ["MERO_SERVICE_TOKEN"] = "test-internal-service-token-32-characters"

from starlette.routing import Match  # noqa: E402
from app import app  # noqa: E402
from database import engine  # noqa: E402


def matched_endpoint(path: str, method: str = "GET") -> str | None:
    scope = {"type": "http", "path": path, "method": method, "root_path": ""}
    for route in app.routes:
        match, _child_scope = route.matches(scope)
        if match is Match.FULL:
            return getattr(route.endpoint, "__name__", None)
    return None


class RouteOrderTests(unittest.TestCase):
    @classmethod
    def tearDownClass(cls):
        engine.dispose()
        _TEMP_DIRECTORY.cleanup()

    def test_nested_note_and_folder_routes_resolve_before_path_catch_alls(self):
        self.assertEqual(matched_endpoint("/api/notes/note-1/videos"), "get_note_videos")
        self.assertEqual(matched_endpoint("/api/notes/note-1/images"), "get_note_images")
        self.assertEqual(matched_endpoint("/api/folders/folder-1/notes"), "get_folder_notes")
        self.assertEqual(matched_endpoint("/api/notes/nested/path"), "get_note")
        self.assertEqual(matched_endpoint("/api/entries"), "list_entries")
        self.assertEqual(matched_endpoint("/api/entries/entry-1/hints"), "entry_hints")
        self.assertEqual(matched_endpoint("/api/entries/entry-1/assignment", "PUT"), "update_entry_assignment")
        self.assertEqual(matched_endpoint("/api/projects"), "list_projects")
        self.assertEqual(matched_endpoint("/api/projects/project-1/unlinked"), "project_unlinked_entries")
        self.assertEqual(matched_endpoint("/api/clients"), "list_clients")
        self.assertEqual(matched_endpoint("/api/exports/job-1"), "get_export")
        self.assertEqual(matched_endpoint("/api/folders/nested/path"), "get_folder")

    def test_note_get_catch_all_remains_after_every_declared_nested_note_get(self):
        note_get_routes = [route for route in app.routes if "GET" in getattr(route, "methods", set()) and getattr(route, "path", "").startswith("/api/notes/")]
        self.assertEqual(note_get_routes[-1].path, "/api/notes/{note_id:path}")


if __name__ == "__main__":
    unittest.main()
