const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/auth');
const { db } = require('../config/database');
const { JWT_SIGNING_KEY } = require('../config/security');
const { deleteCredential, getCredentialStatus, saveCredential } = require('../services/credentials');
const { getLoginStatus, startLogin } = require('../services/openaiOAuth');

const router = express.Router();
const PROVIDERS = new Set(['gemini', 'openai']);

function signToken(user) {
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign(
    { userId: user.id, userUuid: user.user_uuid, username: user.username },
    JWT_SIGNING_KEY,
    { algorithm: 'HS256', expiresIn }
  );
}

function publicUser(row) {
  return { id: row.id, uuid: row.user_uuid, username: row.username, email: row.email };
}

function getAuthenticatedUser(req) {
  return db.prepare('SELECT id, user_uuid, username, email, created_at FROM users WHERE id = ? AND user_uuid = ?')
    .get(req.user.userId, req.user.userUuid);
}

router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body || {};
    if (!username || typeof username !== 'string' || !username.trim()) {
      return res.status(400).json({ error: 'Username is required' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password too short (min 6 chars)' });
    }

    const normalizedUsername = username.trim();
    if (db.prepare('SELECT id FROM users WHERE username = ?').get(normalizedUsername)) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    const normalizedEmail = typeof email === 'string' && email.trim() ? email.trim() : null;
    if (normalizedEmail && db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail)) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userUuid = crypto.randomUUID();
    const info = db.prepare('INSERT INTO users (user_uuid, username, email, password_hash) VALUES (?, ?, ?, ?)')
      .run(userUuid, normalizedUsername, normalizedEmail, passwordHash);
    const user = { id: info.lastInsertRowid, user_uuid: userUuid, username: normalizedUsername, email: normalizedEmail };

    return res.status(201).json({ success: true, user: publicUser(user), token: signToken(user) });
  } catch (err) {
    console.error('Register failed:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || typeof username !== 'string' || !username.trim()) {
      return res.status(400).json({ error: 'Username is required' });
    }
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Password is required' });
    }

    const user = db.prepare('SELECT id, user_uuid, username, email, password_hash FROM users WHERE username = ?')
      .get(username.trim());
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    return res.status(200).json({ success: true, user: publicUser(user), token: signToken(user) });
  } catch (err) {
    console.error('Login failed:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/logout', (req, res) => res.status(200).json({ success: true }));

router.get('/me', authMiddleware, (req, res) => {
  const user = getAuthenticatedUser(req);
  return user ? res.status(200).json(publicUser(user)) : res.status(404).json({ error: 'User not found' });
});

router.post('/credentials/openai/oauth/start', authMiddleware, async (req, res) => {
  try {
    return res.status(200).json(await startLogin(req.user.userUuid));
  } catch (error) {
    const status = error.message.includes('already in progress') ? 409 : 503;
    return res.status(status).json({ error: error.message });
  }
});

router.get('/credentials/openai/oauth/status', authMiddleware, (req, res) => {
  const login = getLoginStatus(req.user.userUuid);
  const stored = getCredentialStatus(req.user.userUuid, 'openai');
  return res.status(200).json({ ...stored, oauth: login });
});

function validateProvider(req, res) {
  const provider = req.params.provider;
  if (!PROVIDERS.has(provider)) {
    res.status(404).json({ error: 'Credential provider not found' });
    return null;
  }
  return provider;
}

router.get('/credentials/:provider/status', authMiddleware, (req, res) => {
  const provider = validateProvider(req, res);
  if (!provider) return;
  return res.status(200).json(getCredentialStatus(req.user.userUuid, provider));
});

router.put('/credentials/:provider', authMiddleware, (req, res) => {
  const provider = validateProvider(req, res);
  if (!provider) return;
  const { credential, credentialType = 'api_key' } = req.body || {};
  try {
    saveCredential(req.user.userUuid, provider, credentialType, credential);
    if (provider === 'gemini') {
      db.prepare('UPDATE users SET gemini_api_key_encrypted = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_uuid = ?')
        .run(req.user.userUuid);
    }
    return res.status(200).json(getCredentialStatus(req.user.userUuid, provider));
  } catch (err) {
    if (err instanceof TypeError) return res.status(400).json({ error: err.message });
    console.error('Failed to save credential');
    return res.status(500).json({ error: 'Failed to save credential' });
  }
});

router.delete('/credentials/:provider', authMiddleware, (req, res) => {
  const provider = validateProvider(req, res);
  if (!provider) return;
  deleteCredential(req.user.userUuid, provider);
  return res.status(200).json({ success: true });
});

// Backward-compatible Gemini route names; responses never contain plaintext credentials.
router.post('/api-key', authMiddleware, (req, res) => {
  try {
    saveCredential(req.user.userUuid, 'gemini', 'api_key', req.body?.apiKey);
    db.prepare('UPDATE users SET gemini_api_key_encrypted = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_uuid = ?')
      .run(req.user.userUuid);
    return res.status(200).json({ success: true, ...getCredentialStatus(req.user.userUuid, 'gemini') });
  } catch (err) {
    if (err instanceof TypeError) return res.status(400).json({ error: err.message });
    console.error('Failed to save API key');
    return res.status(500).json({ error: 'Failed to save API key' });
  }
});

router.get('/api-key', authMiddleware, (req, res) => {
  const status = getCredentialStatus(req.user.userUuid, 'gemini');
  return res.status(200).json({ hasKey: status.configured, ...status });
});

router.delete('/api-key', authMiddleware, (req, res) => {
  deleteCredential(req.user.userUuid, 'gemini');
  return res.status(200).json({ success: true });
});

module.exports = router;
