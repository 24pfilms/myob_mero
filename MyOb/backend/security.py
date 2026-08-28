import contextvars
import hmac
import os
import re
import uuid
from dataclasses import dataclass

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

_UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$", re.IGNORECASE)
_REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{1,128}$")
_PUBLIC_PATHS = frozenset({"/health"})


@dataclass(frozen=True)
class RequestContext:
    user_uuid: str
    request_id: str
    ai_credential: str | None
    ai_credential_type: str | None = None
    ai_account_id: str | None = None


_request_context: contextvars.ContextVar[RequestContext | None] = contextvars.ContextVar("mero_request_context", default=None)


def require_service_token() -> str:
    token = os.environ.get("MERO_SERVICE_TOKEN", "")
    if len(token) < 32:
        raise RuntimeError("MERO_SERVICE_TOKEN must be set to at least 32 characters")
    return token


def get_request_context() -> RequestContext:
    context = _request_context.get()
    if context is None:
        raise RuntimeError("Mero request context is unavailable")
    return context


def get_ai_credential() -> str:
    credential = get_request_context().ai_credential
    if not credential:
        raise RuntimeError("AI credential is unavailable for this request")
    return credential


def run_with_request_context(context: RequestContext, callback) -> None:
    reset_token = _request_context.set(context)
    try:
        callback()
    finally:
        _request_context.reset(reset_token)


class MeroTrustBoundaryMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, service_token: str | None = None):
        super().__init__(app)
        self._service_token = service_token or require_service_token()

    async def dispatch(self, request: Request, call_next):
        if request.url.path in _PUBLIC_PATHS:
            return await call_next(request)

        supplied_token = request.headers.get("X-Mero-Service-Token", "")
        if not supplied_token or not hmac.compare_digest(supplied_token, self._service_token):
            return JSONResponse({"detail": "Internal authentication required"}, status_code=401)
        user_uuid = request.headers.get("X-Mero-User-Id", "")
        if not _UUID.fullmatch(user_uuid):
            return JSONResponse({"detail": "Valid Mero user identity required"}, status_code=400)
        request_id = request.headers.get("X-Request-Id", "")
        if not _REQUEST_ID.fullmatch(request_id):
            request_id = str(uuid.uuid4())
        ai_credential = request.headers.get("X-Mero-AI-Credential")
        credential_type = request.headers.get("X-Mero-AI-Credential-Type")
        account_id = request.headers.get("X-Mero-AI-Account-Id")
        if ai_credential is not None and (not ai_credential or len(ai_credential) > 8192):
            return JSONResponse({"detail": "Invalid AI credential header"}, status_code=400)
        if ai_credential is not None and (credential_type != "oauth_codex" or not account_id or len(account_id) > 128):
            return JSONResponse({"detail": "Incomplete OpenAI OAuth context"}, status_code=400)

        context = RequestContext(
            user_uuid=user_uuid.lower(), request_id=request_id, ai_credential=ai_credential,
            ai_credential_type=credential_type, ai_account_id=account_id,
        )
        request.state.mero = context
        reset_token = _request_context.set(context)
        try:
            response = await call_next(request)
            response.headers["X-Request-Id"] = request_id
            return response
        finally:
            _request_context.reset(reset_token)
