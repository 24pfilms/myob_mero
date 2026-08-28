import json
import os
from collections.abc import Iterable

import requests

from security import get_request_context

CODEX_RESPONSES_URL = "https://chatgpt.com/backend-api/codex/responses"
DEFAULT_MODEL = "gpt-5.4"
MAX_RESPONSE_BYTES = 2 * 1024 * 1024


class CodexProviderError(RuntimeError):
    def __init__(self, code: str, status_code: int = 502):
        super().__init__(code)
        self.code = code
        self.status_code = status_code


def _response_text(events: Iterable[str]) -> str:
    total = 0
    final_response = None
    deltas: list[str] = []
    for raw_line in events:
        line = raw_line.decode("utf-8", errors="replace") if isinstance(raw_line, bytes) else raw_line
        total += len(line.encode("utf-8"))
        if total > MAX_RESPONSE_BYTES:
            raise CodexProviderError("AI_RESPONSE_TOO_LARGE")
        if not line.startswith("data: ") or line == "data: [DONE]":
            continue
        try:
            event = json.loads(line[6:])
        except json.JSONDecodeError:
            continue
        if event.get("type") == "response.output_text.delta" and isinstance(event.get("delta"), str):
            deltas.append(event["delta"])
        if event.get("type") in {"response.completed", "response.done"} and isinstance(event.get("response"), dict):
            final_response = event["response"]
    if deltas:
        return "".join(deltas).strip()
    if final_response:
        output_text = final_response.get("output_text")
        if isinstance(output_text, str) and output_text.strip():
            return output_text.strip()
        for item in final_response.get("output", []):
            for content in item.get("content", []):
                if content.get("type") == "output_text" and isinstance(content.get("text"), str):
                    deltas.append(content["text"])
    text = "".join(deltas).strip()
    if not text:
        raise CodexProviderError("AI_INVALID_RESPONSE")
    return text


class CodexProvider:
    def __init__(self, session=requests, model: str | None = None):
        self.session = session
        self.model = model or os.getenv("OPENAI_CHAT_MODEL", DEFAULT_MODEL)

    def complete(self, instructions: str, messages: list[dict[str, str]]) -> str:
        context = get_request_context()
        if context.ai_credential_type != "oauth_codex" or not context.ai_credential or not context.ai_account_id:
            raise CodexProviderError("AI_CREDENTIAL_UNAVAILABLE", 424)
        try:
            response = self.session.post(
                CODEX_RESPONSES_URL,
                headers={
                    "Authorization": f"Bearer {context.ai_credential}",
                    "ChatGPT-Account-Id": context.ai_account_id,
                    "Content-Type": "application/json",
                    "OpenAI-Beta": "responses=experimental",
                    "originator": "mero",
                },
                json={
                    "model": self.model,
                    "instructions": instructions,
                    "input": [
                        {"role": message["role"], "content": [{"type": "input_text", "text": message["content"]}]}
                        for message in messages
                    ],
                    "store": False,
                    "stream": True,
                },
                timeout=(10, 90),
                allow_redirects=False,
                stream=True,
            )
        except requests.RequestException as error:
            raise CodexProviderError("AI_UPSTREAM_UNAVAILABLE", 503) from error
        if response.status_code == 429:
            raise CodexProviderError("AI_RATE_LIMITED", 429)
        if response.status_code in {401, 403}:
            raise CodexProviderError("AI_CREDENTIAL_REJECTED", 424)
        if response.status_code >= 500:
            raise CodexProviderError("AI_UPSTREAM_UNAVAILABLE", 503)
        if not response.ok:
            raise CodexProviderError("AI_REQUEST_FAILED", 502)
        return _response_text(response.iter_lines(decode_unicode=True))
