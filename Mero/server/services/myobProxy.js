const { randomUUID } = require('crypto');

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;
const HOP_BY_HOP_HEADERS = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade']);

function getUpstreamBaseUrl() {
  const configured = process.env.MYOB_BASE_URL || 'http://127.0.0.1:8001';
  const url = new URL(configured);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) {
    throw new Error('MYOB_BASE_URL must be an HTTP loopback URL');
  }
  return url;
}

function requireServiceToken() {
  const token = process.env.MYOB_SERVICE_TOKEN || '';
  if (token.length < 32) throw new Error('MYOB_SERVICE_TOKEN must be set to at least 32 characters');
  return token;
}

const UPSTREAM_BASE_URL = getUpstreamBaseUrl();
const SERVICE_TOKEN = requireServiceToken();

function normalizedError(status, requestId, retryAfter) {
  if (status === 429) return { status: 429, body: { error: 'MYOB_RATE_LIMITED', requestId }, headers: retryAfter ? { 'Retry-After': retryAfter } : {} };
  if (status === 401 || status === 403) return { status: 502, body: { error: 'MYOB_INTERNAL_AUTH_FAILED', requestId }, headers: {} };
  if (status >= 500) return { status: 502, body: { error: 'MYOB_UPSTREAM_FAILED', requestId }, headers: {} };
  return { status, body: { error: 'MYOB_REQUEST_FAILED', requestId }, headers: {} };
}

async function proxyMyObRequest({ method, upstreamPath, body, userUuid, requestId, aiCredential, aiAccountId, aiCredentialType, timeoutMs = 15_000, fetchImpl = fetch }) {
  const safeRequestId = REQUEST_ID_PATTERN.test(requestId || '') ? requestId : randomUUID();
  const target = new URL(upstreamPath, UPSTREAM_BASE_URL);
  if (target.origin !== UPSTREAM_BASE_URL.origin) throw new Error('MyOb upstream path escaped loopback origin');
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Mero-User-Id': userUuid,
    'X-Mero-Service-Token': SERVICE_TOKEN,
    'X-Request-Id': safeRequestId,
  };
  if (aiCredential) headers['X-Mero-AI-Credential'] = aiCredential;
  if (aiAccountId) headers['X-Mero-AI-Account-Id'] = aiAccountId;
  if (aiCredentialType) headers['X-Mero-AI-Credential-Type'] = aiCredentialType;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(target, {
      method,
      headers,
      body: body === undefined || method === 'GET' || method === 'HEAD' ? undefined : JSON.stringify(body),
      redirect: 'error',
      signal: controller.signal,
    });
    if (!response.ok) return normalizedError(response.status, safeRequestId, response.headers.get('retry-after'));
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > 5 * 1024 * 1024) return { status: 502, body: { error: 'MYOB_RESPONSE_TOO_LARGE', requestId: safeRequestId }, headers: {} };
    const text = await response.text();
    if (Buffer.byteLength(text) > 5 * 1024 * 1024) return { status: 502, body: { error: 'MYOB_RESPONSE_TOO_LARGE', requestId: safeRequestId }, headers: {} };
    let responseBody = null;
    if (text) {
      try {
        responseBody = JSON.parse(text);
      } catch {
        return { status: 502, body: { error: 'MYOB_INVALID_RESPONSE', requestId: safeRequestId }, headers: {} };
      }
    }
    return { status: response.status, body: responseBody, headers: { 'X-Request-Id': safeRequestId } };
  } catch (error) {
    if (error.name === 'AbortError') return { status: 504, body: { error: 'MYOB_TIMEOUT', requestId: safeRequestId }, headers: {} };
    return { status: 502, body: { error: 'MYOB_UNAVAILABLE', requestId: safeRequestId }, headers: {} };
  } finally {
    clearTimeout(timeout);
  }
}

function sanitizedRequestHeaders(headers) {
  return Object.fromEntries(Object.entries(headers).filter(([name]) => !HOP_BY_HOP_HEADERS.has(name.toLowerCase()) && !['authorization', 'cookie', 'x-mero-service-token', 'x-mero-ai-credential'].includes(name.toLowerCase())));
}

module.exports = { getUpstreamBaseUrl, proxyMyObRequest, requireServiceToken, sanitizedRequestHeaders };
