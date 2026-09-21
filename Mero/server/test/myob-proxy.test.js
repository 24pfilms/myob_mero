const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { spawnSync } = require('child_process');

process.env.JWT_SIGNING_KEY = 'test-jwt-signing-key-at-least-32-characters';
process.env.API_KEY_ENCRYPTION_KEY = 'test-encryption-key-at-least-32-characters';
process.env.MYOB_SERVICE_TOKEN = 'test-myob-service-token-at-least-32-characters';
process.env.MYOB_BASE_URL = 'http://127.0.0.1:8001';
process.env.DATABASE_PATH = ':memory:';

const { allowed } = require('../routes/myob');
const { proxyMyObRequest } = require('../services/myobProxy');

const USER_UUID = '123e4567-e89b-42d3-a456-426614174000';

test('proxy injects only internal identity headers and returns JSON', async () => {
  let observed;
  const fetchImpl = async (url, options) => {
    observed = { url: url.toString(), options };
    return new Response(JSON.stringify({ notes: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const result = await proxyMyObRequest({
    method: 'GET',
    upstreamPath: '/api/notes?q=term',
    userUuid: USER_UUID,
    requestId: 'request-1',
    aiCredential: 'ephemeral-ai-value',
    aiAccountId: 'account-123',
    aiCredentialType: 'oauth_codex',
    fetchImpl,
  });

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { notes: [] });
  assert.equal(observed.url, 'http://127.0.0.1:8001/api/notes?q=term');
  assert.equal(observed.options.headers['X-Mero-User-Id'], USER_UUID);
  assert.equal(observed.options.headers['X-Mero-Service-Token'], process.env.MYOB_SERVICE_TOKEN);
  assert.equal(observed.options.headers['X-Mero-AI-Credential'], 'ephemeral-ai-value');
  assert.equal(observed.options.headers['X-Mero-AI-Account-Id'], 'account-123');
  assert.equal(observed.options.headers['X-Mero-AI-Credential-Type'], 'oauth_codex');
  assert.equal(observed.options.headers.Authorization, undefined);
  assert.equal(observed.options.headers.Cookie, undefined);
});

test('proxy normalizes upstream rate limits without forwarding response bodies', async () => {
  const fetchImpl = async () => new Response(JSON.stringify({ detail: 'upstream-private-body' }), { status: 429, headers: { 'Retry-After': '3' } });
  const result = await proxyMyObRequest({ method: 'POST', upstreamPath: '/api/ai/chat', body: { query: 'hello' }, userUuid: USER_UUID, fetchImpl });
  assert.equal(result.status, 429);
  assert.deepEqual(result.body.error, 'MYOB_RATE_LIMITED');
  assert.equal(JSON.stringify(result.body).includes('upstream-private-body'), false);
  assert.equal(result.headers['Retry-After'], '3');
});

test('route allowlist excludes host filesystem and arbitrary upstream paths', () => {
  assert.equal(allowed('GET', '/notes'), true);
  assert.equal(allowed('POST', '/ai/chat'), true);
  assert.equal(allowed('GET', '/filesystem/browse'), false);
  assert.equal(allowed('POST', '/vault/import'), false);
  assert.equal(allowed('GET', '//example.com/steal'), false);
});

test('search and scope routes are allowed only in their exact shapes', () => {
  for (const [method, route] of [
    ['POST', '/notes/bulk'],
    ['GET', '/note-groups'],
    ['POST', '/note-groups'],
    ['PUT', '/note-groups/group-1'],
    ['DELETE', '/note-groups/group-1'],
    ['GET', '/personas'],
    ['POST', '/personas'],
    ['PUT', '/personas/persona-1'],
    ['DELETE', '/personas/persona-1'],
    ['GET', '/semantic-search'],
  ]) {
    assert.equal(allowed(method, route), true, `${method} ${route} should be allowed`);
  }

  for (const [method, route] of [
    ['GET', '/note-groups/group-1'],
    ['POST', '/note-groups/group-1'],
    ['DELETE', '/note-groups'],
    ['PUT', '/personas'],
    ['DELETE', '/personas'],
    ['PUT', '/personas/a/b'],
    ['POST', '/semantic-search'],
    ['GET', '/note-groups/../personas'],
  ]) {
    assert.equal(allowed(method, route), false, `${method} ${route} should be refused`);
  }
});

test('journal routes are allowed only in their exact shapes', () => {
  for (const [method, route] of [
    ['GET', '/entries'],
    ['GET', '/entries/entry-1/hints'],
    ['PUT', '/entries/entry-1/assignment'],
    ['GET', '/clients'],
    ['POST', '/clients'],
    ['PUT', '/clients/client-1'],
    ['GET', '/projects'],
    ['GET', '/projects/project-1/unlinked'],
    ['POST', '/projects'],
    ['PUT', '/projects/project-1'],
    ['POST', '/exports'],
    ['GET', '/exports/job-1'],
  ]) {
    assert.equal(allowed(method, route), true, `${method} ${route} should be allowed`);
  }

  for (const [method, route] of [
    ['GET', '/entries/../notes'],
    ['GET', '/entries/entry-1'],
    ['PUT', '/entries/a/b/assignment'],
    ['DELETE', '/entries/entry-1/assignment'],
    ['GET', '/projects/x/y'],
    ['DELETE', '/projects/project-1'],
    ['GET', '/exports'],
    ['POST', '/exports/job-1'],
    ['PUT', '/clients/client-1/archive'],
    ['GET', '/clients/client-1'],
  ]) {
    assert.equal(allowed(method, route), false, `${method} ${route} should be refused`);
  }
});

test('proxy configuration fails closed when the internal token is missing', () => {
  const result = spawnSync(process.execPath, ['-e', "require('./services/myobProxy')"], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, MYOB_SERVICE_TOKEN: '' },
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /MYOB_SERVICE_TOKEN must be set/);
});
