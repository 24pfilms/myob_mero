const crypto = require('crypto');
const http = require('http');
const { db } = require('../config/database');
const { deleteCredential, getCredential, saveCredential } = require('./credentials');

const CLIENT_ID = process.env.OPENAI_OAUTH_CLIENT_ID || 'app_EMoamEEZ73f0CkXaXp7hrann';
const ORIGINATOR = process.env.OPENAI_OAUTH_ORIGINATOR || 'ggcoder';
const AUTHORIZE_URL = 'https://auth.openai.com/oauth/authorize';
const TOKEN_URL = 'https://auth.openai.com/oauth/token';
const CALLBACK_PORT = 1455;
const CALLBACK_PATH = '/auth/callback';
const SCOPE = 'openid profile email offline_access api.connectors.read api.connectors.invoke';
const JWT_CLAIM = 'https://api.openai.com/auth';
const LOGIN_TIMEOUT_MS = 180_000;

let activeLogin = null;
const loginStatus = new Map();
const refreshes = new Map();

function generatePkce() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  return { verifier, challenge: crypto.createHash('sha256').update(verifier, 'ascii').digest('base64url') };
}

function buildAuthorizeUrl(challenge, state, redirectUri = `http://localhost:${CALLBACK_PORT}${CALLBACK_PATH}`) {
  const url = new URL(AUTHORIZE_URL);
  const params = {
    response_type: 'code', client_id: CLIENT_ID, redirect_uri: redirectUri, scope: SCOPE,
    code_challenge: challenge, code_challenge_method: 'S256', state, prompt: 'login',
    id_token_add_organizations: 'true', codex_cli_simplified_flow: 'true', originator: ORIGINATOR,
  };
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  return url.toString();
}

function decodeJwtPayload(value) {
  try {
    const parts = value.split('.');
    if (parts.length !== 3 || !parts[1]) return null;
    const parsed = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function getAccountId(accessValue) {
  const auth = decodeJwtPayload(accessValue)?.[JWT_CLAIM];
  return typeof auth?.chatgpt_account_id === 'string' && auth.chatgpt_account_id ? auth.chatgpt_account_id : null;
}

async function tokenRequest(fields, fetchImpl = fetch) {
  const response = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const error = new Error(`OpenAI OAuth token request failed with status ${response.status}`);
    error.status = response.status;
    throw error;
  }
  const data = await response.json();
  if (typeof data.access_token !== 'string' || !data.access_token || !Number.isFinite(data.expires_in)) {
    throw new Error('OpenAI OAuth token response is incomplete');
  }
  return data;
}

async function exchangeCode(code, verifier, redirectUri, fetchImpl = fetch) {
  const data = await tokenRequest({
    grant_type: 'authorization_code', client_id: CLIENT_ID, code,
    redirect_uri: redirectUri, code_verifier: verifier,
  }, fetchImpl);
  if (typeof data.refresh_token !== 'string' || !data.refresh_token) throw new Error('OpenAI OAuth returned no refresh token');
  const accountId = getAccountId(data.access_token);
  if (!accountId) throw new Error('OpenAI OAuth token has no ChatGPT account ID');
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: Date.now() + data.expires_in * 1000, accountId };
}

async function refreshCredential(current, fetchImpl = fetch) {
  const data = await tokenRequest({ grant_type: 'refresh_token', client_id: CLIENT_ID, refresh_token: current.refreshToken }, fetchImpl);
  return {
    accessToken: data.access_token,
    refreshToken: typeof data.refresh_token === 'string' && data.refresh_token ? data.refresh_token : current.refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
    accountId: getAccountId(data.access_token) || current.accountId,
  };
}

function createCallbackServer({ expectedState, onCode, port = CALLBACK_PORT, timeoutMs = LOGIN_TIMEOUT_MS }) {
  const sockets = new Set();
  let settled = false;
  let timer;
  const finish = () => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    for (const socket of sockets) socket.destroy();
    sockets.clear();
    server.close();
  };
  const server = http.createServer((request, response) => {
    const url = new URL(request.url || '', `http://localhost:${port}`);
    if (url.pathname !== CALLBACK_PATH) {
      response.writeHead(404, { Connection: 'close' });
      response.end('Not found');
      return;
    }
    if (url.searchParams.get('state') !== expectedState) {
      response.writeHead(400, { Connection: 'close' });
      response.end('State mismatch');
      setImmediate(() => { onCode(new Error('OAuth state mismatch')); finish(); });
      return;
    }
    const code = url.searchParams.get('code');
    if (!code) {
      response.writeHead(400, { Connection: 'close' });
      response.end('Missing authorization code');
      setImmediate(() => { onCode(new Error('Missing authorization code')); finish(); });
      return;
    }
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', Connection: 'close' });
    response.end('<!doctype html><title>Mero</title><h1>Signed in to OpenAI</h1><p>You can close this tab.</p>');
    setImmediate(() => { onCode(null, code); finish(); });
  });
  server.on('connection', socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  timer = setTimeout(() => { onCode(new Error('OpenAI OAuth login timed out')); finish(); }, timeoutMs);
  timer.unref?.();
  return { server, finish };
}

async function startLogin(ownerUuid, options = {}) {
  if (activeLogin) throw new Error('An OpenAI OAuth login is already in progress');
  const { verifier, challenge } = generatePkce();
  const state = crypto.randomBytes(32).toString('base64url');
  const port = options.port ?? CALLBACK_PORT;
  const redirectUri = `http://localhost:${port}${CALLBACK_PATH}`;
  const authorizeUrl = buildAuthorizeUrl(challenge, state, redirectUri);
  loginStatus.set(ownerUuid, { state: 'pending' });

  const callback = createCallbackServer({
    expectedState: state,
    port,
    timeoutMs: options.timeoutMs,
    onCode: async (error, code) => {
      if (error) {
        loginStatus.set(ownerUuid, { state: 'failed', error: error.message });
        activeLogin = null;
        return;
      }
      try {
        const credential = await exchangeCode(code, verifier, redirectUri, options.fetchImpl);
        saveCredential(ownerUuid, 'openai', 'refreshable_token', JSON.stringify(credential));
        loginStatus.set(ownerUuid, { state: 'connected', accountId: credential.accountId, expiresAt: credential.expiresAt });
      } catch (exchangeError) {
        loginStatus.set(ownerUuid, { state: 'failed', error: exchangeError.message });
      } finally {
        activeLogin = null;
      }
    },
  });
  activeLogin = { ownerUuid, finish: callback.finish };
  await new Promise((resolve, reject) => {
    callback.server.once('error', reject);
    callback.server.listen(port, '127.0.0.1', resolve);
  }).catch(error => {
    callback.finish();
    activeLogin = null;
    loginStatus.set(ownerUuid, { state: 'failed', error: 'OAuth callback port is unavailable' });
    throw error;
  });
  return { authorizeUrl };
}

function getLoginStatus(ownerUuid) {
  return loginStatus.get(ownerUuid) || { state: 'disconnected' };
}

function parseStoredCredential(ownerUuid) {
  const stored = getCredential(ownerUuid, 'openai');
  if (!stored || stored.credentialType !== 'refreshable_token') return null;
  try {
    const parsed = JSON.parse(stored.credential);
    if (!parsed.accessToken || !parsed.refreshToken || !parsed.accountId || !Number.isFinite(parsed.expiresAt)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function acquireRefreshLease(ownerUuid, leaseId) {
  return db.transaction(() => {
    const now = Date.now();
    const existing = db.prepare('SELECT lease_id, expires_at FROM oauth_refresh_leases WHERE owner_uuid = ? AND provider = ?').get(ownerUuid, 'openai');
    if (existing && existing.expires_at > now) return false;
    db.prepare(`
      INSERT INTO oauth_refresh_leases (owner_uuid, provider, lease_id, expires_at)
      VALUES (?, 'openai', ?, ?)
      ON CONFLICT(owner_uuid, provider) DO UPDATE SET lease_id = excluded.lease_id, expires_at = excluded.expires_at
    `).run(ownerUuid, leaseId, now + 30_000);
    return true;
  }).immediate();
}

function releaseRefreshLease(ownerUuid, leaseId) {
  db.prepare('DELETE FROM oauth_refresh_leases WHERE owner_uuid = ? AND provider = ? AND lease_id = ?').run(ownerUuid, 'openai', leaseId);
}

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function refreshStoredCredential(ownerUuid, fetchImpl = fetch) {
  let current = parseStoredCredential(ownerUuid);
  if (!current) throw new Error('OpenAI OAuth credential is unavailable');
  if (current.expiresAt > Date.now() + 60_000) return current;

  const leaseId = crypto.randomUUID();
  if (!acquireRefreshLease(ownerUuid, leaseId)) {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await delay(250);
      current = parseStoredCredential(ownerUuid);
      if (current?.expiresAt > Date.now() + 60_000) return current;
      const lease = db.prepare('SELECT expires_at FROM oauth_refresh_leases WHERE owner_uuid = ? AND provider = ?').get(ownerUuid, 'openai');
      if (!lease || lease.expires_at <= Date.now()) return refreshStoredCredential(ownerUuid, fetchImpl);
    }
    throw new Error('OpenAI OAuth refresh timed out');
  }

  try {
    current = parseStoredCredential(ownerUuid);
    if (current.expiresAt > Date.now() + 60_000) return current;
    const refreshed = await refreshCredential(current, fetchImpl);
    saveCredential(ownerUuid, 'openai', 'refreshable_token', JSON.stringify(refreshed));
    return refreshed;
  } catch (error) {
    if ([400, 401].includes(error.status)) deleteCredential(ownerUuid, 'openai');
    throw error;
  } finally {
    releaseRefreshLease(ownerUuid, leaseId);
  }
}

function getUsableOAuthCredential(ownerUuid, fetchImpl = fetch) {
  if (!refreshes.has(ownerUuid)) {
    const pending = refreshStoredCredential(ownerUuid, fetchImpl).finally(() => refreshes.delete(ownerUuid));
    refreshes.set(ownerUuid, pending);
  }
  return refreshes.get(ownerUuid);
}

module.exports = {
  CALLBACK_PATH, buildAuthorizeUrl, createCallbackServer, decodeJwtPayload, exchangeCode,
  generatePkce, getAccountId, getLoginStatus, getUsableOAuthCredential, refreshCredential, startLogin,
};
