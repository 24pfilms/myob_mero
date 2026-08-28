const INSECURE_DEFAULTS = new Set([
  'dev-jwt-signing-key-change-me',
  'default-encryption-key-change-in-production-32ch',
]);

function requireSecret(name) {
  const value = process.env[name];
  if (!value || value.length < 32 || INSECURE_DEFAULTS.has(value)) {
    throw new Error(`${name} must be set to a non-default value of at least 32 characters`);
  }
  return value;
}

const JWT_SIGNING_KEY = requireSecret('JWT_SIGNING_KEY');
const API_KEY_ENCRYPTION_KEY = requireSecret('API_KEY_ENCRYPTION_KEY');

module.exports = { JWT_SIGNING_KEY, API_KEY_ENCRYPTION_KEY };
