# Backend Server Status (Mero)

**Date:** 2025-12-12  
**Repo branch:** `master`  
**Backend location:** `server/`  
**Frontend location:** project root (Vite)

## 1) Current Status Summary

### ✅ What is implemented and working
- Backend API server (Express) running on **`http://localhost:3000`**
- SQLite persistence at **`server/database.sqlite`** (auto-created/auto-initialized)
- JWT authentication with bcrypt password hashing
- Boards CRUD + settings
- Canvas items sync (full replace) + bulk updates + per-item update/delete
- Image uploads via multipart to `server/uploads/`, served as static `/uploads/...`

### ✅ Automated testing in place
- Backend integration tests exist and pass:
  - auth register/login/me
  - protected routes require token
  - multi-user isolation (user B cannot access user A’s boards)
  - item create + bulk update + full sync

### ✅ Frontend integration status
- Frontend now uses the backend API when authenticated (JWT present)
- Local IndexedDB mode remains as fallback when not logged in

## 2) How to Start (Local Dev)

### Option A (Windows): use the launcher
Run:
```bat
start.bat
```
This opens two windows:
- **Mero Backend - API** (port **3000**)
- **Mero Frontend - Vite** (port **3001**)

### Option B: two terminals
```bash
npm run server:dev
npm run dev
```

## 3) Environment Variables

Backend reads env vars via `dotenv` on startup.

Create `server/.env` (recommended) with:
```env
PORT=3000
JWT_SIGNING_KEY (set to a long random string)
JWT_EXPIRES_IN=7d

DATABASE_PATH=./database.sqlite
UPLOADS_PATH=./uploads

# Allow frontend dev server
CORS_ORIGIN=http://localhost:3001
```

Frontend optional (defaults already work):
```env
VITE_API_URL=http://localhost:3000/api
```

## 4) Backend Endpoints

### Health
- `GET /health` → `{ ok: true }`

### Auth (`/api/auth`)
- `POST /api/auth/register` `{ username, password, email? }`
- `POST /api/auth/login` `{ username, password }`
- `GET /api/auth/me` (Bearer token)
- `POST /api/auth/logout` (stateless; client discards token)

### Boards (`/api/boards`) — requires Bearer token
- `GET /api/boards` → list boards
- `POST /api/boards` → create board
- `GET /api/boards/:boardId` → board + settings + items
- `PUT /api/boards/:boardId` → update name/description
- `DELETE /api/boards/:boardId` → delete board
- `PUT /api/boards/:boardId/settings` → update `{ pan_x, pan_y, zoom, background_color, dot_density }`

### Items (`/api/boards/:boardId/items`) — requires Bearer token
- `POST /api/boards/:boardId/items` → create a single item
- `PUT /api/boards/:boardId/items/:itemId` → update a single item
- `DELETE /api/boards/:boardId/items/:itemId` → delete a single item
- `PUT /api/boards/:boardId/items/bulk` → bulk update
- `POST /api/boards/:boardId/items/sync` → **full replace** of items on a board

### Upload (`/api/upload`) — requires Bearer token
- `POST /api/upload/image` (multipart field name: `image`) → returns `{ url }`

## 5) Data Storage / Files

- SQLite DB file: `server/database.sqlite`
- Uploads directory: `server/uploads/<userId>/...`
- Both are gitignored.

## 6) Running Tests

### Backend integration tests
```bash
npm --prefix server test
```

### Frontend typecheck/build
```bash
npx tsc --noEmit
npm run build
```

## 7) Manual Test Checklist (for Monday)

1. Start servers (`start.bat`)
2. Register a user in the UI
3. Create a board in Board Manager
4. Place items on the canvas (sticky note, text, shape, frame)
5. Refresh the page → board + items should reload from backend
6. Create a second user → confirm they do **not** see the first user’s boards
7. Drop an image onto the canvas → ensure it uploads and persists
8. Switch boards → confirm no page reload and correct content loads

## 8) Known Gaps / Follow-ups (Not Blocking Local Testing)

- No rate limiting (login brute-force protection)
- No refresh tokens / token rotation
- No production reverse-proxy (nginx) setup documented here
- Upload endpoint currently validates by mimetype only (good enough for local dev, should harden for prod)

## 9) File Map (Backend)

```text
server/
  app.js                  # createApp() for tests/runtime
  index.js                # starts listening on PORT
  config/database.js      # sqlite init + schema bootstrap
  middleware/auth.js      # JWT verification
  models/schema.sql       # sqlite schema
  routes/auth.js          # /api/auth/*
  routes/boards.js        # /api/boards/*
  routes/items.js         # /api/boards/:boardId/items/*
  routes/upload.js        # /api/upload/image
  test/api.test.js        # node:test + supertest integration tests
```
