const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const request = require('supertest');

const uploads = fs.mkdtempSync(path.join(os.tmpdir(), 'mero-upload-'));
process.env.JWT_SIGNING_KEY = 'upload-test-jwt-signing-key-32-characters';
process.env.API_KEY_ENCRYPTION_KEY = 'upload-test-encryption-key-32-characters';
process.env.MYOB_SERVICE_TOKEN = 'upload-test-service-token-32-characters';
process.env.DATABASE_PATH = ':memory:';
process.env.UPLOADS_PATH = uploads;
process.env.CORS_ORIGIN = 'http://localhost:3001';

const { createApp } = require('../app');

async function token(app) {
  const response = await request(app).post('/api/auth/register').send({ username: 'uploader', password: 'upload-password-123' });
  return response.body.token;
}

test('image upload accepts verified PNG bytes and rejects spoofed content', async t => {
  t.after(() => fs.rmSync(uploads, { recursive: true, force: true }));
  const app = createApp();
  const authorization = `Bearer ${await token(app)}`;
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.from('seed')]);

  const accepted = await request(app).post('/api/upload/image').set('Authorization', authorization).attach('image', png, { filename: 'unsafe.html', contentType: 'image/png' }).expect(201);
  assert.match(accepted.body.url, /\.png$/);
  assert.equal(fs.readFileSync(path.join(uploads, accepted.body.url.replace('/uploads/', ''))).equals(png), true);

  await request(app).post('/api/upload/image').set('Authorization', authorization).attach('image', Buffer.from('<script>'), { filename: 'fake.png', contentType: 'image/png' }).expect(400);
  assert.equal([...fs.readdirSync(uploads, { recursive: true })].filter(name => String(name).endsWith('.png')).length, 1);
});
