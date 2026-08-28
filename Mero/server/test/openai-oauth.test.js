const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

process.env.JWT_SIGNING_KEY = 'test-jwt-signing-key-at-least-32-characters';
process.env.API_KEY_ENCRYPTION_KEY = 'test-encryption-key-at-least-32-characters';
process.env.MYOB_SERVICE_TOKEN = 'test-myob-service-token-at-least-32-characters';
process.env.DATABASE_PATH = ':memory:';

const { db } = require('../config/database');
const { saveCredential } = require('../services/credentials');
const {
  CALLBACK_PATH, buildAuthorizeUrl, createCallbackServer, exchangeCode, generatePkce,
  getAccountId, getUsableOAuthCredential, refreshCredential,
} = require('../services/openaiOAuth');

const OWNER = '123e4567-e89b-42d3-a456-426614174000';

function jwt(accountId) {
  const payload = Buffer.from(JSON.stringify({ 'https://api.openai.com/auth': { chatgpt_account_id: accountId } })).toString('base64url');
  return `header.${payload}.signature`;
}

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
}

test('PKCE and authorize URL include the complete required OpenAI contract', () => {
  const { verifier, challenge } = generatePkce();
  assert.match(verifier, /^[A-Za-z0-9_-]+$/);
  assert.match(challenge, /^[A-Za-z0-9_-]+$/);
  assert.equal(challenge.includes('='), false);
  const url = new URL(buildAuthorizeUrl(challenge, 'state-value'));
  for (const name of ['client_id', 'redirect_uri', 'scope', 'code_challenge', 'state', 'prompt', 'id_token_add_organizations', 'codex_cli_simplified_flow', 'originator']) {
    assert.ok(url.searchParams.get(name), `${name} missing`);
  }
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
});

test('code exchange requires refresh token and ChatGPT account ID', async () => {
  const fetchImpl = async (_url, options) => {
    assert.equal(options.headers['Content-Type'], 'application/x-www-form-urlencoded');
    return jsonResponse({ access_token: jwt('account-1'), refresh_token: 'refresh-value', expires_in: 3600 });
  };
  const result = await exchangeCode('code-value', 'verifier-value', 'http://localhost:1455/auth/callback', fetchImpl);
  assert.equal(result.accountId, 'account-1');
  assert.equal(result.refreshToken, 'refresh-value');
  assert.ok(result.expiresAt > Date.now());
  assert.equal(getAccountId(result.accessToken), 'account-1');
});

test('refresh preserves rotated fields when OpenAI omits replacements', async () => {
  const current = { accessToken: jwt('old-account'), refreshToken: 'old-refresh', expiresAt: 0, accountId: 'old-account' };
  const refreshed = await refreshCredential(current, async () => jsonResponse({ access_token: jwt('new-account'), expires_in: 3600 }));
  assert.equal(refreshed.refreshToken, 'old-refresh');
  assert.equal(refreshed.accountId, 'new-account');
});

test('concurrent refresh callers perform one token request', async () => {
  db.prepare('INSERT INTO users (user_uuid, username, password_hash) VALUES (?, ?, ?)').run(OWNER, 'oauth-user', 'hash');
  saveCredential(OWNER, 'openai', 'refreshable_token', JSON.stringify({ accessToken: jwt('account-1'), refreshToken: 'refresh-value', expiresAt: 0, accountId: 'account-1' }));
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    await new Promise(resolve => setTimeout(resolve, 20));
    return jsonResponse({ access_token: jwt('account-1'), refresh_token: 'rotated-refresh', expires_in: 3600 });
  };
  const [first, second] = await Promise.all([getUsableOAuthCredential(OWNER, fetchImpl), getUsableOAuthCredential(OWNER, fetchImpl)]);
  assert.equal(calls, 1);
  assert.equal(first.refreshToken, 'rotated-refresh');
  assert.equal(second.refreshToken, 'rotated-refresh');
});

test('callback rejects mismatched state and closes without waiting for keep-alive', async () => {
  let callbackError;
  let resolveCallback;
  const callbackDone = new Promise(resolve => { resolveCallback = resolve; });
  const callback = createCallbackServer({
    expectedState: 'expected', port: 0, timeoutMs: 2000,
    onCode: error => { callbackError = error; resolveCallback(); },
  });
  await new Promise((resolve, reject) => {
    callback.server.once('error', reject);
    callback.server.listen(0, '127.0.0.1', resolve);
  });
  const port = callback.server.address().port;
  const agent = new http.Agent({ keepAlive: true });
  await new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: `${CALLBACK_PATH}?code=value&state=wrong`, agent }, response => {
      response.resume();
      response.on('end', resolve);
    }).on('error', reject);
  });
  await callbackDone;
  assert.match(callbackError.message, /state mismatch/i);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(callback.server.listening, false);
  agent.destroy();
});
