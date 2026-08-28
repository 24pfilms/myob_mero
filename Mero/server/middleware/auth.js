const jwt = require('jsonwebtoken');
const { JWT_SIGNING_KEY } = require('../config/security');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(authHeader.slice('Bearer '.length), JWT_SIGNING_KEY, { algorithms: ['HS256'] });
    if (!Number.isSafeInteger(decoded.userId) || !UUID_PATTERN.test(decoded.userUuid || '')) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = authMiddleware;
