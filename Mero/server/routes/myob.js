const express = require('express');
const authMiddleware = require('../middleware/auth');
const { getUsableOAuthCredential } = require('../services/openaiOAuth');
const { proxyMyObRequest } = require('../services/myobProxy');

const router = express.Router();

const ALLOWED = [
  ['GET', /^\/health$/],
  ['GET', /^\/notes(?:\/.*)?$/],
  ['POST', /^\/notes$/],
  ['POST', /^\/notes\/(?:import-bulk|similarity-matrix)$/],
  ['POST', /^\/notes\/.+\/versions\/\d+\/restore$/],
  ['PUT', /^\/notes\/.+/],
  ['DELETE', /^\/notes\/.+/],
  ['GET', /^\/folders(?:\/.*)?$/],
  ['POST', /^\/folders$/],
  ['GET', /^\/(?:semantic-search|stats)$/],
  ['POST', /^\/embeddings\/reindex$/],
  ['GET', /^\/embeddings\/jobs\/[^/]+$/],
  ['POST', /^\/videos\/[^/]+\/process$/],
  ['POST', /^\/content\/import\/(?:quick|bulk)$/],
  ['GET', /^\/content\/import\/[^/]+\/status$/],
  ['POST', /^\/ai\/(?:chat|general-chat|suggest-links|save-conversation|generate-image)$/],
  ['GET', /^\/ai\/(?:conversation-history|settings|analyze-connections\/.+)$/],
  ['PUT', /^\/ai\/settings$/],
  ['GET', /^\/images\/[^/]+$/],
  ['PUT', /^\/images\/[^/]+\/(?:favorite|tags)$/],
  ['DELETE', /^\/images\/[^/]+$/],
  ['GET', /^\/entries$/],
  ['GET', /^\/entries\/[^/]+\/hints$/],
  ['PUT', /^\/entries\/[^/]+\/assignment$/],
  ['GET', /^\/clients$/],
  ['POST', /^\/clients$/],
  ['PUT', /^\/clients\/[^/]+$/],
  ['GET', /^\/projects$/],
  ['GET', /^\/projects\/[^/]+\/unlinked$/],
  ['POST', /^\/projects$/],
  ['PUT', /^\/projects\/[^/]+$/],
  ['POST', /^\/exports$/],
  ['GET', /^\/exports\/[^/]+$/],
];
const AI_PATH = /^\/(?:ai\/|content\/|videos\/)/;

function allowed(method, path) {
  return ALLOWED.some(([allowedMethod, pattern]) => allowedMethod === method && pattern.test(path));
}

router.use(authMiddleware);
router.use(async (req, res) => {
  if (!allowed(req.method, req.path)) return res.status(404).json({ error: 'MyOb route not allowed' });

  let oauth;
  if (AI_PATH.test(req.path)) {
    try {
      oauth = await getUsableOAuthCredential(req.user.userUuid);
    } catch {
      return res.status(503).json({ error: 'OPENAI_OAUTH_UNAVAILABLE' });
    }
  }

  const result = await proxyMyObRequest({
    method: req.method,
    upstreamPath: req.path === '/health' ? '/health' : `/api${req.url}`,
    body: req.body,
    userUuid: req.user.userUuid,
    requestId: req.get('X-Request-Id'),
    aiCredential: oauth?.accessToken,
    aiAccountId: oauth?.accountId,
    aiCredentialType: oauth ? 'oauth_codex' : undefined,
    timeoutMs: req.path.startsWith('/ai/') ? 100_000 : req.path.startsWith('/content/import') ? 60_000 : 15_000,
  });
  for (const [name, value] of Object.entries(result.headers)) res.set(name, value);
  return result.body === null ? res.sendStatus(result.status) : res.status(result.status).json(result.body);
});

module.exports = router;
module.exports.allowed = allowed;
