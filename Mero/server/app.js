const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const authRoutes = require('./routes/auth');
const boardRoutes = require('./routes/boards');
const myobRoutes = require('./routes/myob');
const itemsRoutes = require('./routes/items');
const uploadRoutes = require('./routes/upload');
const authMiddleware = require('./middleware/auth');

// Ensure DB is initialized on startup.
require('./config/database');

function createApp() {
  const app = express();

  const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3001';
  const UPLOADS_PATH = process.env.UPLOADS_PATH || './uploads';
  const uploadsRoot = path.isAbsolute(UPLOADS_PATH) ? UPLOADS_PATH : path.resolve(__dirname, UPLOADS_PATH);

  if (!fs.existsSync(uploadsRoot)) {
    fs.mkdirSync(uploadsRoot, { recursive: true });
  }

  app.use(
    cors({
      origin: CORS_ORIGIN,
    })
  );

  app.use(express.json({ limit: '10mb' }));
  app.use('/uploads', express.static(uploadsRoot));

  app.get('/health', (req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/boards', boardRoutes);
  app.use('/api/myob', myobRoutes);
  app.use('/api/boards/:boardId/items', authMiddleware, itemsRoutes);
  app.use('/api/upload', authMiddleware, uploadRoutes);

  // Basic error handler
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

module.exports = { createApp };
