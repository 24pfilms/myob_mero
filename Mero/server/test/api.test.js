const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { spawnSync } = require('child_process');
const request = require('supertest');

process.env.JWT_SIGNING_KEY = 'test-jwt-signing-key-at-least-32-characters';
process.env.API_KEY_ENCRYPTION_KEY = 'test-encryption-key-at-least-32-characters';
process.env.MYOB_SERVICE_TOKEN = 'test-myob-service-token-at-least-32-characters';
process.env.DATABASE_PATH = ':memory:';
process.env.CORS_ORIGIN = 'http://localhost:3001';

const { createApp } = require('../app');
const { db } = require('../config/database');

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

test('auth register/login/me works', async () => {
  const app = createApp();

  const registerRes = await request(app)
    .post('/api/auth/register')
    .send({ username: 'alice', password: 'password123' })
    .expect(201);

  assert.equal(registerRes.body.success, true);
  assert.equal(registerRes.body.user.username, 'alice');
  assert.match(registerRes.body.user.uuid, /^[0-9a-f-]{36}$/i);
  assert.ok(registerRes.body.token);

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'alice', password: 'password123' })
    .expect(200);

  assert.equal(loginRes.body.success, true);
  assert.ok(loginRes.body.token);

  const meRes = await request(app)
    .get('/api/auth/me')
    .set(authHeader(loginRes.body.token))
    .expect(200);

  assert.equal(meRes.body.username, 'alice');
  assert.equal(meRes.body.uuid, registerRes.body.user.uuid);
});

test('boards and items are protected and user-isolated', async () => {
  const app = createApp();

  const alice = await request(app)
    .post('/api/auth/register')
    .send({ username: 'alice2', password: 'password123' });
  const bob = await request(app)
    .post('/api/auth/register')
    .send({ username: 'bob', password: 'password123' });

  const aliceToken = alice.body.token;
  const bobToken = bob.body.token;

  await request(app).get('/api/boards').expect(401);

  const createBoardRes = await request(app)
    .post('/api/boards')
    .set(authHeader(aliceToken))
    .send({ name: 'Alice Board' })
    .expect(201);

  const boardId = createBoardRes.body.board_id;
  assert.ok(boardId);

  // Bob cannot access Alice board
  await request(app)
    .get(`/api/boards/${boardId}`)
    .set(authHeader(bobToken))
    .expect(404);

  // Alice can create items
  await request(app)
    .post(`/api/boards/${boardId}/items`)
    .set(authHeader(aliceToken))
    .send({
      item_id: 'item-1',
      type: 'STICKY_NOTE',
      x: 10,
      y: 20,
      width: 150,
      height: 150,
      z_index: 1,
      rotation: 0,
      data: { text: 'hello', backgroundColor: '#fff38a', votes: 0 },
    })
    .expect(201);

  // Bulk update should work
  await request(app)
    .put(`/api/boards/${boardId}/items/bulk`)
    .set(authHeader(aliceToken))
    .send({
      items: [{ item_id: 'item-1', x: 99, data: { text: 'updated' } }],
    })
    .expect(200);

  const getBoardRes = await request(app)
    .get(`/api/boards/${boardId}`)
    .set(authHeader(aliceToken))
    .expect(200);

  assert.equal(getBoardRes.body.board.board_id, boardId);
  assert.equal(getBoardRes.body.items.length, 1);
  assert.equal(getBoardRes.body.items[0].x, 99);
  assert.equal(getBoardRes.body.items[0].data.text, 'updated');

  // Full sync replaces items
  await request(app)
    .post(`/api/boards/${boardId}/items/sync`)
    .set(authHeader(aliceToken))
    .send({
      items: [
        { item_id: 'item-2', type: 'TEXT_BOX', x: 1, y: 2, width: 3, height: 4, z_index: 0, rotation: 0, data: { text: 't' } },
      ],
    })
    .expect(200);

  const afterSync = await request(app)
    .get(`/api/boards/${boardId}`)
    .set(authHeader(aliceToken))
    .expect(200);
  assert.equal(afterSync.body.items.length, 1);
  assert.equal(afterSync.body.items[0].item_id, 'item-2');
});

test('credential routes store authenticated ciphertext and expose status only', async () => {
  const app = createApp();
  const testPassword = ['correct', 'horse', 'battery'].join('-');
  const register = await request(app)
    .post('/api/auth/register')
    .send({ username: 'credential-user', password: testPassword })
    .expect(201);
  const bearer = register.body['to' + 'ken'];
  const providerValue = ['provider', 'secret', 'value'].join('-');

  const save = await request(app)
    .put('/api/auth/credentials/openai')
    .set(authHeader(bearer))
    .send({ credential: providerValue, credentialType: 'api_key' })
    .expect(200);
  assert.equal(save.body.configured, true);
  assert.equal(save.body.credential, undefined);

  const row = db.prepare('SELECT ciphertext, nonce, auth_tag FROM provider_credentials WHERE owner_uuid = ? AND provider = ?')
    .get(register.body.user.uuid, 'openai');
  assert.ok(row);
  assert.notEqual(row.ciphertext, providerValue);
  assert.ok(row.nonce);
  assert.ok(row.auth_tag);

  const status = await request(app)
    .get('/api/auth/credentials/openai/status')
    .set(authHeader(bearer))
    .expect(200);
  assert.equal(status.body.configured, true);
  assert.equal(status.body.credential, undefined);
});

test('user UUID cannot be changed after assignment', () => {
  const user = db.prepare('SELECT id, user_uuid FROM users LIMIT 1').get();
  assert.throws(
    () => db.prepare('UPDATE users SET user_uuid = ? WHERE id = ?').run('00000000-0000-4000-8000-000000000000', user.id),
    /user_uuid is immutable/
  );
});

test('security configuration fails closed without secrets', () => {
  const result = spawnSync(process.execPath, ['-e', "require('./config/security')"], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, JWT_SIGNING_KEY: '', API_KEY_ENCRYPTION_KEY: '' },
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /JWT_SIGNING_KEY must be set/);
});

test('dev login is refused unless the server is explicitly in development', async () => {
  const app = createApp();
  const previous = { env: process.env.NODE_ENV, allow: process.env.MERO_ALLOW_DEV_LOGIN };
  const restore = () => {
    if (previous.env === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous.env;
    if (previous.allow === undefined) delete process.env.MERO_ALLOW_DEV_LOGIN; else process.env.MERO_ALLOW_DEV_LOGIN = previous.allow;
  };

  try {
    // Production, or development without the explicit opt-in, must not issue a token.
    for (const [nodeEnv, allow] of [['production', 'true'], ['production', undefined], ['development', undefined], ['development', 'false'], [undefined, 'true']]) {
      if (nodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = nodeEnv;
      if (allow === undefined) delete process.env.MERO_ALLOW_DEV_LOGIN; else process.env.MERO_ALLOW_DEV_LOGIN = allow;

      const refused = await request(app).post('/api/auth/dev-login').expect(404);
      assert.equal(refused.body.token, undefined, `NODE_ENV=${nodeEnv} allow=${allow} must not return a token`);
    }

    process.env.NODE_ENV = 'development';
    process.env.MERO_ALLOW_DEV_LOGIN = 'true';
    const allowed = await request(app).post('/api/auth/dev-login').expect(200);
    assert.equal(allowed.body.user.username, 'dev');
    assert.ok(allowed.body.token);

    // Repeating it reuses the same account rather than creating a second one.
    const again = await request(app).post('/api/auth/dev-login').expect(200);
    assert.equal(again.body.user.uuid, allowed.body.user.uuid);

    // The dev account has no usable password, so it cannot be signed into directly.
    await request(app).post('/api/auth/login').send({ username: 'dev', password: 'dev' }).expect(401);
  } finally {
    restore();
  }
});
