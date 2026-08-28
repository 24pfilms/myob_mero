require('dotenv').config();

const { createApp } = require('./app');

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
