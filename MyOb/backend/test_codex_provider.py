import unittest

from codex_provider import CODEX_RESPONSES_URL, CodexProvider, CodexProviderError
from security import RequestContext, run_with_request_context


class FakeResponse:
    def __init__(self, status=200, lines=()):
        self.status_code = status
        self.ok = 200 <= status < 300
        self._lines = lines

    def iter_lines(self, decode_unicode=False):
        return iter(self._lines)


class FakeSession:
    def __init__(self, response):
        self.response = response
        self.call = None

    def post(self, url, **kwargs):
        self.call = (url, kwargs)
        return self.response


class CodexProviderTests(unittest.TestCase):
    def context(self, credential="private-oauth-token"):
        return RequestContext(
            user_uuid="11111111-1111-4111-8111-111111111111",
            request_id="request-1",
            ai_credential=credential,
            ai_credential_type="oauth_codex",
            ai_account_id="account-1",
        )

    def test_sends_request_scoped_oauth_and_parses_stream_without_storing(self):
        session = FakeSession(FakeResponse(lines=(
            'data: {"type":"response.output_text.delta","delta":"Hello "}',
            'data: {"type":"response.output_text.delta","delta":"world"}',
            "data: [DONE]",
        )))
        result = []
        run_with_request_context(self.context(), lambda: result.append(
            CodexProvider(session=session, model="gpt-test").complete(
                "Answer briefly", [{"role": "user", "content": "Hi"}]
            )
        ))

        self.assertEqual(result, ["Hello world"])
        url, request = session.call
        self.assertEqual(url, CODEX_RESPONSES_URL)
        self.assertEqual(request["headers"]["Authorization"], "Bearer private-oauth-token")
        self.assertEqual(request["headers"]["ChatGPT-Account-Id"], "account-1")
        self.assertEqual(request["json"]["model"], "gpt-test")
        self.assertFalse(request["json"]["store"])
        self.assertTrue(request["json"]["stream"])
        self.assertNotIn("private-oauth-token", str(request["json"]))
        self.assertFalse(request["allow_redirects"])

    def test_maps_rate_limit_without_upstream_body(self):
        session = FakeSession(FakeResponse(status=429))
        errors = []
        run_with_request_context(self.context(), lambda: self._capture(
            errors, lambda: CodexProvider(session=session).complete("Help", [{"role": "user", "content": "Hi"}])
        ))
        self.assertEqual((errors[0].code, errors[0].status_code), ("AI_RATE_LIMITED", 429))

    def test_fails_closed_without_oauth_context(self):
        errors = []
        context = RequestContext("11111111-1111-4111-8111-111111111111", "request-1", None)
        run_with_request_context(context, lambda: self._capture(
            errors, lambda: CodexProvider(session=FakeSession(FakeResponse())).complete("Help", [])
        ))
        self.assertEqual((errors[0].code, errors[0].status_code), ("AI_CREDENTIAL_UNAVAILABLE", 424))

    @staticmethod
    def _capture(errors, callback):
        try:
            callback()
        except CodexProviderError as error:
            errors.append(error)


if __name__ == "__main__":
    unittest.main()
