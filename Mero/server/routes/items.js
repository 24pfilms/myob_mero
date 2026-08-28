const express = require('express');
const { db } = require('../config/database');

const router = express.Router({ mergeParams: true });

function ensureBoardOwned(boardId, userId) {
  return db
    .prepare('SELECT id, board_id FROM boards WHERE board_id = ? AND user_id = ?')
    .get(boardId, userId);
}

function parseJsonSafe(str) {
  try {
    return JSON.parse(str);
  } catch {
    return {};
  }
}

router.post('/', (req, res) => {
  const { boardId } = req.params;
  const userId = req.user.userId;

  const board = ensureBoardOwned(boardId, userId);
  if (!board) return res.status(404).json({ error: 'Board not found' });

  const {
    item_id,
    type,
    x = 0,
    y = 0,
    width = 150,
    height = 150,
    z_index = 0,
    rotation = 0,
    data = {},
  } = req.body || {};

  if (!item_id || typeof item_id !== 'string') {
    return res.status(400).json({ error: 'item_id is required' });
  }
  if (!type || typeof type !== 'string') {
    return res.status(400).json({ error: 'type is required' });
  }

  try {
    db.prepare(
      'INSERT INTO canvas_items (item_id, board_id, user_id, type, x, y, width, height, z_index, rotation, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      item_id,
      boardId,
      userId,
      type,
      x,
      y,
      width,
      height,
      z_index,
      rotation,
      JSON.stringify(data ?? {})
    );

    return res.status(201).json({
      success: true,
      item: { item_id, type, x, y, width, height, z_index, rotation, data },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Create item failed:', err);
    return res.status(400).json({ error: 'Failed to create item' });
  }
});

// IMPORTANT: keep bulk/sync BEFORE "/:itemId" routes so they don't get treated as item IDs.
router.put('/bulk', (req, res) => {
  const { boardId } = req.params;
  const userId = req.user.userId;

  const board = ensureBoardOwned(boardId, userId);
  if (!board) return res.status(404).json({ error: 'Board not found' });

  const { items } = req.body || {};
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'items must be an array' });
  }

  const updateStmt = db.prepare(
    'UPDATE canvas_items SET type = COALESCE(?, type), x = COALESCE(?, x), y = COALESCE(?, y), width = COALESCE(?, width), height = COALESCE(?, height), z_index = COALESCE(?, z_index), rotation = COALESCE(?, rotation), data = ?, updated_at = CURRENT_TIMESTAMP WHERE item_id = ? AND board_id = ? AND user_id = ?'
  );
  const getStmt = db.prepare('SELECT data FROM canvas_items WHERE item_id = ? AND board_id = ? AND user_id = ?');

  const tx = db.transaction((rows) => {
    for (const it of rows) {
      if (!it || typeof it.item_id !== 'string') continue;
      const existing = getStmt.get(it.item_id, boardId, userId);
      if (!existing) continue;

      const mergedData = it.data ? { ...parseJsonSafe(existing.data), ...it.data } : parseJsonSafe(existing.data);

      updateStmt.run(
        it.type ?? null,
        it.x ?? null,
        it.y ?? null,
        it.width ?? null,
        it.height ?? null,
        it.z_index ?? null,
        it.rotation ?? null,
        JSON.stringify(mergedData ?? {}),
        it.item_id,
        boardId,
        userId
      );
    }
  });

  tx(items);
  return res.status(200).json({ success: true });
});

router.post('/sync', (req, res) => {
  const { boardId } = req.params;
  const userId = req.user.userId;

  const board = ensureBoardOwned(boardId, userId);
  if (!board) return res.status(404).json({ error: 'Board not found' });

  const { items } = req.body || {};
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'items must be an array' });
  }

  const deleteStmt = db.prepare('DELETE FROM canvas_items WHERE board_id = ? AND user_id = ?');
  const insertStmt = db.prepare(
    'INSERT INTO canvas_items (item_id, board_id, user_id, type, x, y, width, height, z_index, rotation, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );

  const tx = db.transaction((rows) => {
    deleteStmt.run(boardId, userId);
    for (const it of rows) {
      if (!it || typeof it.item_id !== 'string' || typeof it.type !== 'string') continue;
      insertStmt.run(
        it.item_id,
        boardId,
        userId,
        it.type,
        it.x ?? 0,
        it.y ?? 0,
        it.width ?? 150,
        it.height ?? 150,
        it.z_index ?? 0,
        it.rotation ?? 0,
        JSON.stringify(it.data ?? {})
      );
    }
  });

  tx(items);
  return res.status(200).json({ success: true });
});

router.put('/:itemId', (req, res) => {
  const { boardId, itemId } = req.params;
  const userId = req.user.userId;

  const board = ensureBoardOwned(boardId, userId);
  if (!board) return res.status(404).json({ error: 'Board not found' });

  const existing = db
    .prepare('SELECT * FROM canvas_items WHERE item_id = ? AND board_id = ? AND user_id = ?')
    .get(itemId, boardId, userId);

  if (!existing) return res.status(404).json({ error: 'Item not found' });

  const body = req.body || {};
  const next = {
    x: body.x ?? existing.x,
    y: body.y ?? existing.y,
    width: body.width ?? existing.width,
    height: body.height ?? existing.height,
    z_index: body.z_index ?? existing.z_index,
    rotation: body.rotation ?? existing.rotation,
    type: body.type ?? existing.type,
    data: body.data ? { ...parseJsonSafe(existing.data), ...body.data } : parseJsonSafe(existing.data),
  };

  db.prepare(
    'UPDATE canvas_items SET type = ?, x = ?, y = ?, width = ?, height = ?, z_index = ?, rotation = ?, data = ?, updated_at = CURRENT_TIMESTAMP WHERE item_id = ? AND board_id = ? AND user_id = ?'
  ).run(
    next.type,
    next.x,
    next.y,
    next.width,
    next.height,
    next.z_index,
    next.rotation,
    JSON.stringify(next.data ?? {}),
    itemId,
    boardId,
    userId
  );

  return res.status(200).json({ success: true, item: { item_id: itemId, ...next } });
});

router.delete('/:itemId', (req, res) => {
  const { boardId, itemId } = req.params;
  const userId = req.user.userId;

  const board = ensureBoardOwned(boardId, userId);
  if (!board) return res.status(404).json({ error: 'Board not found' });

  const info = db
    .prepare('DELETE FROM canvas_items WHERE item_id = ? AND board_id = ? AND user_id = ?')
    .run(itemId, boardId, userId);

  if (info.changes === 0) return res.status(404).json({ error: 'Item not found' });
  return res.status(200).json({ success: true });
});

module.exports = router;
