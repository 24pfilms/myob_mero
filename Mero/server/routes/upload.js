const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { randomUUID } = require('node:crypto');

const router = express.Router();
const IMAGE_TYPES = {
  'image/png': { extension: '.png', valid: bytes => bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
  'image/jpeg': { extension: '.jpg', valid: bytes => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  'image/gif': { extension: '.gif', valid: bytes => bytes.subarray(0, 6).toString('ascii') === 'GIF87a' || bytes.subarray(0, 6).toString('ascii') === 'GIF89a' },
  'image/webp': { extension: '.webp', valid: bytes => bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP' },
};

function getUploadsRoot() {
  const configured = process.env.UPLOADS_PATH;
  const uploads = configured && configured.trim().length > 0 ? configured : './uploads';
  const serverRoot = path.resolve(__dirname, '..');
  return path.isAbsolute(uploads) ? uploads : path.resolve(serverRoot, uploads);
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userId = String(req.user.userId);
    const userDir = path.join(getUploadsRoot(), userId);
    ensureDir(userDir);
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    cb(null, `image-${randomUUID()}${IMAGE_TYPES[file.mimetype]?.extension || ''}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (IMAGE_TYPES[file.mimetype]) return cb(null, true);
    const error = new Error('Only PNG, JPEG, GIF, and WebP uploads are allowed');
    error.status = 400;
    return cb(error);
  },
});

router.post('/image', upload.single('image'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const handle = await fs.promises.open(req.file.path, 'r');
    const header = Buffer.alloc(12);
    try { await handle.read(header, 0, header.length, 0); } finally { await handle.close(); }
    if (!IMAGE_TYPES[req.file.mimetype].valid(header)) {
      await fs.promises.unlink(req.file.path);
      return res.status(400).json({ error: 'Image content does not match its declared type' });
    }
    const userId = String(req.user.userId);
    return res.status(201).json({ success: true, url: `/uploads/${userId}/${req.file.filename}`, size: req.file.size });
  } catch (error) {
    if (req.file?.path) await fs.promises.unlink(req.file.path).catch(() => {});
    return next(error);
  }
});

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Image exceeds the 10 MB limit' });
  if (error?.status === 400) return res.status(400).json({ error: error.message });
  return next(error);
});

module.exports = router;
