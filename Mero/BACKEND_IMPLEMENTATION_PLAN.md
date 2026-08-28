# Mero Backend Implementation Plan

## Overview

Build a simple, self-contained backend for the Mero canvas application that supports multiple users with their own boards and data.

**Stack:**
- Express.js (Node.js backend)
- SQLite (single-file database)
- bcrypt (password hashing)
- JWT (session tokens)
- multer (file uploads)

---

## 1. Project Structure

```
/server
├── index.js                 # Main Express server entry point
├── package.json             # Server dependencies
├── .env                     # Environment variables (JWT_SIGNING_KEY, PORT)
├── database.sqlite          # SQLite database file (auto-created)
│
├── /config
│   └── database.js          # SQLite connection setup
│
├── /middleware
│   └── auth.js              # JWT verification middleware
│
├── /routes
│   ├── auth.js              # POST /api/auth/register, /login, /logout, /me
│   ├── boards.js            # CRUD /api/boards
│   └── items.js             # CRUD /api/boards/:boardId/items
│
├── /models
│   └── schema.sql           # Database schema (run on first start)
│
└── /uploads                 # User-uploaded images (gitignored)
    └── /:userId/            # Organized by user ID
```

---

## 2. Database Schema

```sql
-- Users table
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Boards table (each user has multiple boards)
CREATE TABLE boards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    board_id TEXT UNIQUE NOT NULL,        -- UUID for client reference
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL DEFAULT 'Untitled Board',
    description TEXT,
    thumbnail TEXT,                        -- Path to thumbnail image
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Canvas items table (items on each board)
CREATE TABLE canvas_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id TEXT UNIQUE NOT NULL,          -- UUID for client reference
    board_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,                    -- STICKY_NOTE, SHAPE, TEXT_BOX, IMAGE, etc.
    x REAL NOT NULL DEFAULT 0,
    y REAL NOT NULL DEFAULT 0,
    width REAL NOT NULL DEFAULT 150,
    height REAL NOT NULL DEFAULT 150,
    z_index INTEGER NOT NULL DEFAULT 0,
    rotation REAL DEFAULT 0,
    data JSON NOT NULL,                    -- All other item properties (text, colors, etc.)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (board_id) REFERENCES boards(board_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Board settings (pan/zoom state per board)
CREATE TABLE board_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    board_id TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    pan_x REAL DEFAULT 0,
    pan_y REAL DEFAULT 0,
    zoom REAL DEFAULT 1,
    background_color TEXT DEFAULT '#111827',
    dot_density REAL DEFAULT 20,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (board_id) REFERENCES boards(board_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_boards_user_id ON boards(user_id);
CREATE INDEX idx_canvas_items_board_id ON canvas_items(board_id);
CREATE INDEX idx_canvas_items_user_id ON canvas_items(user_id);
```

---

## 3. API Endpoints

### Authentication Routes (`/api/auth`)

#### POST `/api/auth/register`
Create a new user account.

**Request:**
```json
{
    "username": "johndoe",
    "email": "john@example.com",    // optional
    "password": "securepassword123"
}
```

**Response (201):**
```json
{
    "success": true,
    "user": {
        "id": 1,
        "username": "johndoe",
        "email": "john@example.com"
    },
    "token": "<JWT_TOKEN>"
}
```

**Errors:**
- 400: Username already exists
- 400: Password too short (min 6 chars)

---

#### POST `/api/auth/login`
Authenticate and receive JWT token.

**Request:**
```json
{
    "username": "johndoe",
    "password": "securepassword123"
}
```

**Response (200):**
```json
{
    "success": true,
    "user": {
        "id": 1,
        "username": "johndoe",
        "email": "john@example.com"
    },
    "token": "<JWT_TOKEN>"
}
```

**Errors:**
- 401: Invalid username or password

---

#### GET `/api/auth/me`
Get current user info (requires auth).

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "created_at": "2024-01-15T10:30:00Z"
}
```

---

### Board Routes (`/api/boards`)

All routes require `Authorization: Bearer <token>` header.

#### GET `/api/boards`
List all boards for the authenticated user.

**Response (200):**
```json
{
    "boards": [
        {
            "board_id": "uuid-1234",
            "name": "My Project",
            "description": "Project planning board",
            "thumbnail": "/uploads/1/thumb-uuid-1234.png",
            "created_at": "2024-01-15T10:30:00Z",
            "updated_at": "2024-01-16T14:20:00Z"
        }
    ]
}
```

---

#### POST `/api/boards`
Create a new board.

**Request:**
```json
{
    "name": "New Board",
    "description": "Optional description"
}
```

**Response (201):**
```json
{
    "board_id": "uuid-5678",
    "name": "New Board",
    "description": "Optional description",
    "created_at": "2024-01-16T15:00:00Z"
}
```

---

#### GET `/api/boards/:boardId`
Get a specific board with all its items.

**Response (200):**
```json
{
    "board": {
        "board_id": "uuid-1234",
        "name": "My Project",
        "description": "Project planning board"
    },
    "settings": {
        "pan_x": 100,
        "pan_y": 50,
        "zoom": 1.2,
        "background_color": "#111827",
        "dot_density": 20
    },
    "items": [
        {
            "item_id": "item-uuid-1",
            "type": "STICKY_NOTE",
            "x": 100,
            "y": 200,
            "width": 150,
            "height": 150,
            "z_index": 1,
            "rotation": 0,
            "data": {
                "text": "Hello World",
                "backgroundColor": "#fff38a",
                "textColor": "#000000",
                "fontSize": 16
            }
        }
    ]
}
```

**Errors:**
- 404: Board not found
- 403: Board belongs to another user

---

#### PUT `/api/boards/:boardId`
Update board name/description.

**Request:**
```json
{
    "name": "Updated Name",
    "description": "Updated description"
}
```

**Response (200):**
```json
{
    "success": true,
    "board": { ... }
}
```

---

#### DELETE `/api/boards/:boardId`
Delete a board and all its items.

**Response (200):**
```json
{
    "success": true,
    "message": "Board deleted"
}
```

---

#### PUT `/api/boards/:boardId/settings`
Update board settings (pan, zoom, background).

**Request:**
```json
{
    "pan_x": 150,
    "pan_y": 75,
    "zoom": 1.5,
    "background_color": "#1a1a2e",
    "dot_density": 25
}
```

---

### Item Routes (`/api/boards/:boardId/items`)

All routes require authentication.

#### POST `/api/boards/:boardId/items`
Create a new canvas item.

**Request:**
```json
{
    "item_id": "client-generated-uuid",
    "type": "STICKY_NOTE",
    "x": 100,
    "y": 200,
    "width": 150,
    "height": 150,
    "z_index": 5,
    "rotation": 0,
    "data": {
        "text": "New note",
        "backgroundColor": "#fff38a",
        "textColor": "#000000"
    }
}
```

**Response (201):**
```json
{
    "success": true,
    "item": { ... }
}
```

---

#### PUT `/api/boards/:boardId/items/:itemId`
Update an existing item.

**Request:**
```json
{
    "x": 150,
    "y": 250,
    "data": {
        "text": "Updated text"
    }
}
```

---

#### DELETE `/api/boards/:boardId/items/:itemId`
Delete an item.

---

#### PUT `/api/boards/:boardId/items/bulk`
Bulk update multiple items (for efficient saves).

**Request:**
```json
{
    "items": [
        { "item_id": "uuid-1", "x": 100, "y": 200 },
        { "item_id": "uuid-2", "x": 300, "y": 400 }
    ]
}
```

---

#### POST `/api/boards/:boardId/items/sync`
Full sync - replaces all items on board (for initial save or full sync).

**Request:**
```json
{
    "items": [ ... all items ... ]
}
```

---

### Upload Routes (`/api/upload`)

#### POST `/api/upload/image`
Upload an image for use on canvas.

**Request:** `multipart/form-data` with `image` field

**Response (201):**
```json
{
    "success": true,
    "url": "/uploads/1/image-uuid.png",
    "size": 102400
}
```

---

## 4. Authentication Flow

### JWT Token Structure
```json
{
    "userId": 1,
    "username": "johndoe",
    "iat": 1705312200,
    "exp": 1705916200  // 7 days expiry
}
```

### Auth Middleware (`/middleware/auth.js`)
```javascript
const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SIGNING_KEY);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

module.exports = authMiddleware;
```

### Password Hashing
- Use `bcrypt` with salt rounds of 10
- Never store plain passwords
- Compare with `bcrypt.compare()`

---

## 5. Frontend Changes Required

### 5.1 Create API Service (`/services/api.ts`)
```typescript
const API_BASE = process.env.VITE_API_URL || 'http://localhost:3000/api';

class ApiService {
    private token: string | null = null;
    
    setToken(token: string) {
        this.token = token;
        localStorage.setItem('auth_token', token);
    }
    
    getToken() {
        if (!this.token) {
            this.token = localStorage.getItem('auth_token');
        }
        return this.token;
    }
    
    async request(endpoint: string, options: RequestInit = {}) {
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...options.headers,
        };
        
        if (this.getToken()) {
            headers['Authorization'] = `Bearer ${this.getToken()}`;
        }
        
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers,
        });
        
        if (response.status === 401) {
            this.logout();
            window.location.href = '/';
        }
        
        return response.json();
    }
    
    // Auth
    async login(username: string, password: string) { ... }
    async register(username: string, password: string) { ... }
    logout() { this.token = null; localStorage.removeItem('auth_token'); }
    
    // Boards
    async getBoards() { ... }
    async getBoard(boardId: string) { ... }
    async createBoard(name: string) { ... }
    async deleteBoard(boardId: string) { ... }
    
    // Items
    async saveItems(boardId: string, items: BoardItem[]) { ... }
    async uploadImage(file: File) { ... }
}

export const api = new ApiService();
```

### 5.2 Update LoginModal
- Call `api.login()` or `api.register()`
- Store JWT token on success
- Show error messages on failure
- Add registration form/toggle

### 5.3 Update useBoard Hook
- Load items from API instead of IndexedDB
- Save items to API (debounced, on change)
- Handle offline gracefully (queue saves)

### 5.4 Update useBoardManager Hook
- Fetch boards from API
- Create/delete boards via API

### 5.5 Add Logout Button
- Add to toolbar or user menu
- Calls `api.logout()` and redirects to login

---

## 6. Environment Variables

### Server (`.env`)
```
PORT=3000
JWT_SIGNING_KEY (set this to a long random string in production)
DATABASE_PATH=./database.sqlite
UPLOADS_PATH=./uploads
CORS_ORIGIN=http://localhost:3001
```

### Frontend (`.env.local`)
```
VITE_API_URL=http://localhost:3000/api
```

---

## 7. Dependencies

### Server (`/server/package.json`)
```json
{
    "name": "mero-server",
    "version": "1.0.0",
    "scripts": {
        "start": "node index.js",
        "dev": "nodemon index.js"
    },
    "dependencies": {
        "express": "^4.18.2",
        "cors": "^2.8.5",
        "bcrypt": "^5.1.1",
        "jsonwebtoken": "^9.0.2",
        "better-sqlite3": "^9.4.3",
        "multer": "^1.4.5-lts.1",
        "uuid": "^9.0.1",
        "dotenv": "^16.4.1"
    },
    "devDependencies": {
        "nodemon": "^3.0.3"
    }
}
```

---

## 8. Security Considerations

1. **Password Security**
   - Minimum 6 characters
   - Hashed with bcrypt (10 rounds)
   - Never logged or returned in responses

2. **JWT Security**
   - Use strong secret (32+ chars)
   - 7-day expiry
   - Refresh token flow (optional, for later)

3. **Data Isolation**
   - All queries filter by `user_id`
   - Users cannot access other users' boards/items

4. **File Uploads**
   - Validate file types (images only)
   - Limit file size (10MB max)
   - Store in user-specific folders
   - Generate random filenames

5. **Rate Limiting** (optional, for later)
   - Limit login attempts
   - Limit API requests per minute

---

## 9. Startup Sequence

### Server Startup (`index.js`)
```javascript
1. Load environment variables
2. Connect to SQLite database
3. Run schema.sql if tables don't exist
4. Create uploads directory if needed
5. Setup Express middleware (cors, json, auth)
6. Register routes
7. Start listening on PORT
```

### Database Initialization
```javascript
const db = require('better-sqlite3')(process.env.DATABASE_PATH);

// Check if tables exist
const tableExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
).get();

if (!tableExists) {
    const schema = fs.readFileSync('./models/schema.sql', 'utf8');
    db.exec(schema);
    console.log('Database initialized');
}
```

---

## 10. Deployment

### Simple Deployment (Single VPS)
1. Get a VPS ($5-10/month: DigitalOcean, Linode, Vultr)
2. Install Node.js 18+
3. Clone repo
4. `npm install` in both root and /server
5. Build frontend: `npm run build`
6. Use PM2 to run server: `pm2 start server/index.js`
7. Use Nginx as reverse proxy
8. Add SSL with Let's Encrypt

### Docker (Alternative)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY server/ ./server/
COPY dist/ ./dist/
RUN cd server && npm install
EXPOSE 3000
CMD ["node", "server/index.js"]
```

---

## 11. Migration Path

### Phase 1: Build Backend
1. Create `/server` folder structure
2. Implement auth routes
3. Implement board routes
4. Implement item routes
5. Test with Postman/curl

### Phase 2: Connect Frontend
1. Create API service
2. Update LoginModal for real auth
3. Update useBoard to use API
4. Update useBoardManager to use API
5. Add logout functionality

### Phase 3: Data Migration
1. Export existing IndexedDB data
2. Import into SQLite via API
3. Remove IndexedDB code (optional)

### Phase 4: Deploy
1. Set up VPS
2. Deploy backend
3. Build and deploy frontend
4. Configure domain/SSL

---

## 12. Testing Checklist

- [ ] Register new user
- [ ] Login with correct credentials
- [ ] Login with wrong credentials (should fail)
- [ ] Create new board
- [ ] Load board with items
- [ ] Add items to board
- [ ] Edit items
- [ ] Delete items
- [ ] Save board (auto-save)
- [ ] Switch between boards
- [ ] Delete board
- [ ] Upload image
- [ ] Logout
- [ ] Access protected route without token (should fail)
- [ ] Access another user's board (should fail)

---

## Summary

This plan creates a simple, self-contained backend that:
- Stores all data in a single SQLite file
- Supports multiple users with isolated data
- Uses industry-standard auth (bcrypt + JWT)
- Can be deployed on any cheap VPS
- Is easy to backup (just copy the SQLite file)
- Requires no external services

Total new code: ~500-800 lines for backend, ~200-300 lines for frontend changes.
