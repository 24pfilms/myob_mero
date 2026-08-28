import asyncio
import importlib
import json
import os
import unittest
from unittest.mock import patch

from starlette.requests import Request
from starlette.responses import JSONResponse

from security import MeroTrustBoundaryMiddleware, get_request_context, require_service_token

SERVICE_TOKEN = "test-internal-service-token-32-characters"
USER_UUID = "123e4567-e89b-42d3-a456-426614174000"


def request(path="/api/notes", headers=None):
    raw_headers = [(name.lower().encode("ascii"), value.encode("ascii")) for name, value in (headers or {}).items()]
    return Request({"type": "http", "asgi": {"version": "3.0"}, "method": "GET", "path": path, "raw_path": path.encode(), "query_string": b"", "headers": raw_headers, "client": ("127.0.0.1", 1), "server": ("127.0.0.1", 8001), "scheme": "http"})


class SecurityTests(unittest.TestCase):
    def test_missing_or_forged_internal_identity_is_denied(self):
        middleware = MeroTrustBoundaryMiddleware(lambda _scope, _receive, _send: None, SERVICE_TOKEN)

        async def unreachable(_request):
            self.fail("Denied request reached route")

        missing = asyncio.run(middleware.dispatch(request(), unreachable))
        self.assertEqual(missing.status_code, 401)
        forged = asyncio.run(middleware.dispatch(request(headers={"X-Mero-Service-Token": SERVICE_TOKEN, "X-Mero-User-Id": "not-a-uuid"}), unreachable))
        self.assertEqual(forged.status_code, 400)

    def test_valid_request_exposes_tenant_and_ephemeral_ai_context_then_clears_it(self):
        middleware = MeroTrustBoundaryMiddleware(lambda _scope, _receive, _send: None, SERVICE_TOKEN)

        async def route(_request):
            context = get_request_context()
            return JSONResponse({"user": context.user_uuid, "request": context.request_id, "ai": context.ai_credential})

        response = asyncio.run(middleware.dispatch(request(headers={
            "X-Mero-Service-Token": SERVICE_TOKEN,
            "X-Mero-User-Id": USER_UUID,
            "X-Request-Id": "request-123",
            "X-Mero-AI-Credential": "ephemeral-value",
            "X-Mero-AI-Credential-Type": "oauth_codex",
            "X-Mero-AI-Account-Id": "account-123",
        }), route))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(json.loads(response.body), {"user": USER_UUID, "request": "request-123", "ai": "ephemeral-value"})
        self.assertEqual(response.headers["X-Request-Id"], "request-123")
        with self.assertRaisesRegex(RuntimeError, "unavailable"):
            get_request_context()

    def test_service_token_configuration_fails_closed(self):
        with patch.dict(os.environ, {"MERO_SERVICE_TOKEN": ""}, clear=False):
            with self.assertRaisesRegex(RuntimeError, "at least 32"):
                require_service_token()

    def test_ai_module_imports_without_environment_credential(self):
        with patch.dict(os.environ, {"OPENROUTER_API_KEY": ""}, clear=False):
            module = importlib.import_module("ai")
            self.assertTrue(callable(module.get_embedding))

    def test_runner_defaults_to_loopback_port_8001(self):
        runner = importlib.import_module("runner")
        with patch.dict(os.environ, {}, clear=True), patch.object(runner.uvicorn, "run") as run:
            runner.run_api()
        run.assert_called_once_with("app:app", host="127.0.0.1", port=8001, reload=False, log_level="info")


if __name__ == "__main__":
    unittest.main()
