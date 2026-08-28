const express = require('express');
const { randomUUID } = require('node:crypto');
const authMiddleware = require('../middleware/auth');
const { db } = require('../config/database');

const router = express.Router();

function ensureBoardOwned(boardId, userId) {
  return db
    .prepare('SELECT * FROM boards WHERE board_id = ? AND user_id = ?')
    .get(boardId, userId);
}

function getOrCreateSettings(boardId, userId) {
  const existing = db
    .prepare('SELECT * FROM board_settings WHERE board_id = ? AND user_id = ?')
    .get(boardId, userId);

  if (existing) return existing;

  db.prepare(
    'INSERT INTO board_settings (board_id, user_id, pan_x, pan_y, zoom, background_color, dot_density) VALUES (?, ?, 0, 0, 1, ?, 20)'
  ).run(boardId, userId, '#111827');

  return db
    .prepare('SELECT * FROM board_settings WHERE board_id = ? AND user_id = ?')
    .get(boardId, userId);
}

router.use(authMiddleware);

router.get('/', (req, res) => {
  const rows = db
    .prepare(
      'SELECT board_id, name, description, thumbnail, created_at, updated_at FROM boards WHERE user_id = ? ORDER BY updated_at DESC'
    )
    .all(req.user.userId);

  return res.status(200).json({ boards: rows });
});

router.post('/', (req, res) => {
  const { name, description } = req.body || {};
  const boardId = randomUUID();
  const boardName = typeof name === 'string' && name.trim().length > 0 ? name.trim() : 'Untitled Board';

  db.prepare(
    'INSERT INTO boards (board_id, user_id, name, description) VALUES (?, ?, ?, ?)'
  ).run(boardId, req.user.userId, boardName, typeof description === 'string' ? description : null);

  getOrCreateSettings(boardId, req.user.userId);

  const row = db
    .prepare('SELECT board_id, name, description, created_at, updated_at FROM boards WHERE board_id = ?')
    .get(boardId);

  return res.status(201).json(row);
});

router.get('/:boardId', (req, res) => {
  const { boardId } = req.params;
  const board = ensureBoardOwned(boardId, req.user.userId);
  if (!board) {
    return res.status(404).json({ error: 'Board not found' });
  }

  const settings = getOrCreateSettings(boardId, req.user.userId);

  const items = db
    .prepare(
      'SELECT item_id, type, x, y, width, height, z_index, rotation, data FROM canvas_items WHERE board_id = ? AND user_id = ? ORDER BY z_index ASC'
    )
    .all(boardId, req.user.userId)
    .map((row) => {
      let parsed = {};
      try {
        parsed = JSON.parse(row.data);
      } catch {
        parsed = {};
      }
      return {
        item_id: row.item_id,
        type: row.type,
        x: row.x,
        y: row.y,
        width: row.width,
        height: row.height,
        z_index: row.z_index,
        rotation: row.rotation,
        data: parsed,
      };
    });

  return res.status(200).json({
    board: {
      board_id: board.board_id,
      name: board.name,
      description: board.description,
      thumbnail: board.thumbnail,
      created_at: board.created_at,
      updated_at: board.updated_at,
    },
    settings: {
      pan_x: settings.pan_x,
      pan_y: settings.pan_y,
      zoom: settings.zoom,
      background_color: settings.background_color,
      dot_density: settings.dot_density,
    },
    items,
  });
});

router.put('/:boardId', (req, res) => {
  const { boardId } = req.params;
  const board = ensureBoardOwned(boardId, req.user.userId);
  if (!board) {
    return res.status(404).json({ error: 'Board not found' });
  }

  const { name, description } = req.body || {};
  const nextName = typeof name === 'string' ? name.trim() : board.name;
  const nextDescription = typeof description === 'string' ? description : board.description;

  db.prepare(
    "UPDATE boards SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE board_id = ? AND user_id = ?"
  ).run(nextName, nextDescription, boardId, req.user.userId);

  const updated = db
    .prepare('SELECT board_id, name, description, thumbnail, created_at, updated_at FROM boards WHERE board_id = ?')
    .get(boardId);

  return res.status(200).json({ success: true, board: updated });
});

router.delete('/:boardId', (req, res) => {
  const { boardId } = req.params;
  const board = ensureBoardOwned(boardId, req.user.userId);
  if (!board) {
    return res.status(404).json({ error: 'Board not found' });
  }

  db.prepare('DELETE FROM boards WHERE board_id = ? AND user_id = ?').run(boardId, req.user.userId);
  return res.status(200).json({ success: true, message: 'Board deleted' });
});

router.put('/:boardId/settings', (req, res) => {
  const { boardId } = req.params;
  const board = ensureBoardOwned(boardId, req.user.userId);
  if (!board) {
    return res.status(404).json({ error: 'Board not found' });
  }

  const current = getOrCreateSettings(boardId, req.user.userId);
  const {
    pan_x = current.pan_x,
    pan_y = current.pan_y,
    zoom = current.zoom,
    background_color = current.background_color,
    dot_density = current.dot_density,
  } = req.body || {};

  db.prepare(
    'UPDATE board_settings SET pan_x = ?, pan_y = ?, zoom = ?, background_color = ?, dot_density = ?, updated_at = CURRENT_TIMESTAMP WHERE board_id = ? AND user_id = ?'
  ).run(pan_x, pan_y, zoom, background_color, dot_density, boardId, req.user.userId);

  const updated = db
    .prepare('SELECT pan_x, pan_y, zoom, background_color, dot_density FROM board_settings WHERE board_id = ? AND user_id = ?')
    .get(boardId, req.user.userId);

  return res.status(200).json({ success: true, settings: updated });
});

module.exports = router;
