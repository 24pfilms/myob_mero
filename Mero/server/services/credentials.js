const crypto = require('crypto');
const { API_KEY_ENCRYPTION_KEY } = require('../config/security');
const { db } = require('../config/database');

const KEY_VERSION = 1;
const KEY = crypto.scryptSync(API_KEY_ENCRYPTION_KEY, 'mero-provider-credentials-v1', 32);
const PROVIDERS = new Set(['gemini', 'openai']);
const CREDENTIAL_TYPES = new Set(['api_key', 'refreshable_token']);

function assertCredentialInput(provider, credentialType, credential) {
  if (!PROVIDERS.has(provider)) throw new TypeError('Unsupported credential provider');
  if (!CREDENTIAL_TYPES.has(credentialType)) throw new TypeError('Unsupported credential type');
  if (typeof credential !== 'string' || !credential.trim()) throw new TypeError('Credential is required');
}

function encryptCredential(plaintext) {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64'),
    nonce: nonce.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    keyVersion: KEY_VERSION,
  };
}

function decryptCredential(row) {
  if (row.key_version !== KEY_VERSION) throw new Error('Unsupported credential key version');
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(row.nonce, 'base64'));
  decipher.setAuthTag(Buffer.from(row.auth_tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(row.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

function saveCredential(ownerUuid, provider, credentialType, credential) {
  assertCredentialInput(provider, credentialType, credential);
  const encrypted = encryptCredential(credential.trim());
  db.prepare(`
    INSERT INTO provider_credentials
      (owner_uuid, provider, credential_type, ciphertext, nonce, auth_tag, key_version)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(owner_uuid, provider) DO UPDATE SET
      credential_type = excluded.credential_type,
      ciphertext = excluded.ciphertext,
      nonce = excluded.nonce,
      auth_tag = excluded.auth_tag,
      key_version = excluded.key_version,
      verified_at = NULL,
      updated_at = CURRENT_TIMESTAMP
  `).run(ownerUuid, provider, credentialType, encrypted.ciphertext, encrypted.nonce, encrypted.authTag, encrypted.keyVersion);
}

function getCredential(ownerUuid, provider) {
  if (!PROVIDERS.has(provider)) throw new TypeError('Unsupported credential provider');
  const row = db.prepare('SELECT * FROM provider_credentials WHERE owner_uuid = ? AND provider = ?').get(ownerUuid, provider);
  if (row) return { credential: decryptCredential(row), credentialType: row.credential_type };

  if (provider === 'gemini') {
    const legacy = db.prepare('SELECT gemini_api_key_encrypted FROM users WHERE user_uuid = ?').get(ownerUuid);
    if (legacy?.gemini_api_key_encrypted) {
      const [ivHex, ciphertextHex] = legacy.gemini_api_key_encrypted.split(':');
      const key = crypto.scryptSync(API_KEY_ENCRYPTION_KEY, 'salt', 32);
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(ivHex, 'hex'));
      return {
        credential: decipher.update(ciphertextHex, 'hex', 'utf8') + decipher.final('utf8'),
        credentialType: 'api_key',
      };
    }
  }
  return null;
}

function getCredentialStatus(ownerUuid, provider) {
  if (!PROVIDERS.has(provider)) throw new TypeError('Unsupported credential provider');
  const row = db.prepare(`
    SELECT credential_type, verified_at, created_at, updated_at
    FROM provider_credentials WHERE owner_uuid = ? AND provider = ?
  `).get(ownerUuid, provider);
  if (row) return { provider, configured: true, credentialType: row.credential_type, verifiedAt: row.verified_at, updatedAt: row.updated_at };

  const legacy = provider === 'gemini'
    ? db.prepare('SELECT gemini_api_key_encrypted FROM users WHERE user_uuid = ?').get(ownerUuid)
    : null;
  return { provider, configured: Boolean(legacy?.gemini_api_key_encrypted), credentialType: legacy?.gemini_api_key_encrypted ? 'api_key' : null, verifiedAt: null, legacy: Boolean(legacy?.gemini_api_key_encrypted) };
}

function deleteCredential(ownerUuid, provider) {
  if (!PROVIDERS.has(provider)) throw new TypeError('Unsupported credential provider');
  db.transaction(() => {
    db.prepare('DELETE FROM provider_credentials WHERE owner_uuid = ? AND provider = ?').run(ownerUuid, provider);
    if (provider === 'gemini') {
      db.prepare('UPDATE users SET gemini_api_key_encrypted = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_uuid = ?').run(ownerUuid);
    }
  })();
}

module.exports = { deleteCredential, getCredential, getCredentialStatus, saveCredential };
