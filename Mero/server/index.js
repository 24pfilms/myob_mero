require('dotenv').config();

const { createApp } = require('./app');

// Fail closed: the local dev sign-in must never be enabled outside development.
// Refusing to boot makes the commercial transition impossible to get wrong by
// forgetting, rather than relying on someone remembering to unset a variable.
if (process.env.MERO_ALLOW_DEV_LOGIN === 'true' && process.env.NODE_ENV !== 'development') {
  // eslint-disable-next-line no-console
  console.error(`❌ MERO_ALLOW_DEV_LOGIN=true is only permitted when NODE_ENV=development (it is "${process.env.NODE_ENV || 'unset'}"). Unset MERO_ALLOW_DEV_LOGIN, or delete the /auth/dev-login route before shipping.`);
  process.exit(1);
}

const PORT = Number(process.env.PORT || 3000);
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3001';

const app = createApp();

const server = app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`✅ Mero API listening on http://localhost:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`🔒 CORS origin: ${CORS_ORIGIN}`);
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    // eslint-disable-next-line no-console
    console.error(`❌ Backend port ${PORT} is already in use. Close the other process or set PORT in server/.env.`);
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.error('❌ Backend server error:', err);
  process.exit(1);
});
