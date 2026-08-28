# Database Implementation for Mero Canvas

## Overview

This document describes the implementation of a robust local database system for Mero Canvas using IndexedDB via Dexie.js. The new system replaces the previous localStorage-based approach, providing better performance, image persistence, and multi-board support.

## Architecture

### Database Choice: IndexedDB with Dexie.js

**Why IndexedDB?**
- Native browser support for large storage (GBs vs MBs)
- Better performance than localStorage
- Supports binary data (images, videos)
- Asynchronous operations

**Why Dexie.js?**
- Modern, promise-based API
- Excellent TypeScript support
- Built-in versioning and migrations
- Simple query syntax
- Transaction support

### Database Structure

```typescript
// Main database class
class MeroDatabase extends Dexie {
  folders!: Table<FolderEntity>;
  boards!: Table<BoardEntity>;
  canvasItems!: Table<CanvasItemEntity>;
  imageData!: Table<ImageDataEntity>;
  appSettings!: Table<AppSettingsEntity>;
}
```

## Schema Design

### Tables

#### 1. Folders Table (`FolderEntity`)
```typescript
interface FolderEntity {
  id: number;                    // Auto-incrementing primary key
  folderId: string;             // Unique identifier for the folder
  name: string;                 // Folder display name
  parentId?: string;            // Parent folder ID for hierarchy
  isExpanded: boolean;          // UI state for folder expansion
  createdAt: number;
  updatedAt: number;
}
```

#### 2. Boards Table (`BoardEntity`)
```typescript
interface BoardEntity {
  id: number;                    // Auto-incrementing primary key
  boardId: string;              // Unique identifier for the board
  folderId?: string;            // Parent folder ID (null = root)
  name: string;                 // Board display name
  description?: string;         // Board description
  maxZIndex: number;            // Highest z-index for layering
  panZoom: PanZoom;             // Canvas position and zoom state
  backgroundColor: string;       // Board background color
  dotDensity: number;           // Background dot density
  toolbarPosition: string;       // Toolbar position setting
  createdAt: number;
  updatedAt: number;
  lastAccessedAt: number;       // For "recently used" functionality
}
```

#### 3. Canvas Items Table (`CanvasItemEntity`)
```typescript
interface CanvasItemEntity {
  id: number;                    // Auto-incrementing primary key
  itemId: string;               // Unique identifier for the item
  boardId: string;              // Parent board ID
  type: ItemType;               // Item type (sticky note, shape, etc.)
  x: number;                    // Position coordinates
  y: number;
  width: number;                // Dimensions
  height: number;
  z: number;                    // Fixed property name for compatibility
  zIndex: number;               // Layer ordering
  // ... other BoardItem properties
  createdAt: number;
  updatedAt: number;
}
```

#### 4. Image Data Table (`ImageDataEntity`)
```typescript
interface ImageDataEntity {
  id: number;                    // Auto-incrementing primary key
  imageId: string;              // Unique identifier for the image
  itemId: string;               // Associated canvas item ID
  boardId: string;              // Parent board ID
  type: 'src' | 'generatedImageUrl' | 'generatedVideoUrl';
  data: Blob;                   // Binary image data
  fileName: string;
  mimeType: string;
  size: number;                 // File size in bytes
  createdAt: number;
}
```

#### 5. App Settings Table (`AppSettingsEntity`)
```typescript
interface AppSettingsEntity {
  id: number;                    // Auto-incrementing primary key (always 1)
  sidebarWidth: number;
  theme: 'dark' | 'light';
  autoSave: boolean;
  autoSaveInterval: number;
  currentBoardId?: string;      // Currently active board
  recentlyUsedBoards: string[];  // Recent board IDs
  updatedAt: number;
: number;
}
```

## Migration System

### Automatic Migration from localStorage

The system automatically detects existing localStorage data and migrates it to IndexedDB:

```typescript
// MigrationService handles the transition
class MigrationService {
  static async migrateFromLocalStorage(): Promise<MigrationResult> {
    // 1. Load data from localStorage
    // 2. Create board structure
    // 3. Migrate canvas items
    // 4. Extract and store image data as blobs
    // 5. Update app settings
  }
}
```

### Migration Features

- **One-time migration**: Only runs once on first app load
- **Image preservation**: Converts data URLs to binary blobs
- **Board creation**: Automatically creates a board for existing items
- **Settings transfer**: Moves preferences to database
- **Rollback safety**: Original localStorage data preserved

## Database Services

### 1. BoardService (`src/db/services/BoardService.ts`)

Handles all board-related operations:

```typescript
class BoardService {
  static async createBoard(options: CreateBoardOptions): Promise<BoardEntity>
  static async getAllBoards(): Promise<BoardEntity[]>
  static async getBoard(boardId: string): Promise<BoardEntity | undefined>
  static async updateBoard(boardId: string, updates: UpdateBoardOptions): Promise<boolean>
  static async deleteBoard(boardId: string): Promise<boolean>
  static async duplicateBoard(boardId: string): Promise<BoardEntity | null>
  static async getRecentBoards(limit?: number): Promise<BoardEntity[]>
  // ... more methods
}
```

### 2. ItemService (`src/db/services/ItemService.ts`)

Manages canvas items and image data:

```typescript
class ItemService {
  static async getBoardItems(boardId: string): Promise<BoardItem[]>
  static async createItem(boardId: string, item: Omit<BoardItem, 'id'>): Promise<BoardItem>
  static async updateItem(itemId: string, updates: Partial<BoardItem>): Promise<boolean>
  static async deleteItem(itemId: string): Promise<boolean>
  // Image handling methods
  private static async storeImageData(itemId: string, type: string, dataUrl: string)
  private static async getItemImageData(itemId: string): Promise<{[key: string]: string}>
}
```

### 3. FolderService (`src/db/services/FolderService.ts`)

Manages folder hierarchy:

```typescript
class FolderService {
  static async createFolder(options: CreateFolderOptions): Promise<FolderEntity>
  static async getFolderHierarchy(): Promise<FolderEntity[]>
  static async moveFolder(folderId: string, targetParentId?: string): Promise<boolean>
  static async deleteFolder(folderId: string, deleteContents?: boolean): Promise<boolean>
  // Prevents circular references
  private static async wouldCreateCircularReference(folderId: string, newParentId?: string): Promise<boolean>
}
```

## React Hooks Integration

### 1. useDatabase Hook (`src/hooks/useDatabase.ts`)

Handles database initialization and migration:

```typescript
export const useDatabase = () => {
  const [state, setState] = useState<DatabaseState>({
    isInitialized: false,
    isMigrating: false,
    migrationResult: null,
    databaseInfo: null,
    error: null,
  });

  // Auto-initializes on mount
  // Handles migration from localStorage
  // Provides database instance access
};
```

### 2. useBoardManager Hook (`src/hooks/useBoardManager.ts`)

High-level board and item management:

```typescript
export const useBoardManager = () => {
  // State management for boards, folders, current board, items
  // CRUD operations for boards and items
  // Folder management
  // Board switching and navigation
};
```

## Performance Optimizations

### 1. Efficient Queries

```typescript
// Indexed queries for fast lookups
boards.where('folderId').equals(folderId).toArray()
canvasItems.where('boardId').equals(boardId).orderBy('zIndex').toArray()
```

### 2. Batch Operations

```typescript
// Transactions for atomic operations
await db.transaction('rw', db.boards, db.canvasItems, async () => {
  await Promise.all(operations);
});
```

### 3. Image Storage

- Images stored as binary blobs (efficient)
- Separate table for image metadata
- Lazy loading of image data
- Compression opportunities

## Benefits Over localStorage

### 1. Storage Capacity
- **localStorage**: ~5MB per domain
- **IndexedDB**: GBs of storage (depends on device/browser)

### 2. Performance
- **localStorage**: Synchronous, blocking
- **IndexedDB**: Asynchronous, non-blocking

### 3. Data Types
- **localStorage**: Strings only
- **IndexedDB**: Blobs, files, structured data

### 4. Querying
- **localStorage**: Manual parsing and filtering
- **IndexedDB**: Indexed queries, sorting, filtering

### 5. Transactions
- **localStorage**: No transaction support
- **IndexedDB**: ACID-like transactions

## Usage Examples

### Creating a New Board

```typescript
const { createBoard } = useBoardManager();

const newBoard = await createBoard({
  name: 'My New Project',
  description: 'A canvas for brainstorming',
  folderId: 'root'
});
```

### Adding an Item

```typescript
const { addItem } = useBoardManager();

const newItem = await addItem({
  type: ItemType.StickyNote,
  x: 100,
  y: 200,
  width: 200,
  height: 150,
  text: 'Hello World!',
  backgroundColor: '#ffff00'
});
```

### Board Navigation

```typescript
const { switchBoard, currentBoard } = useBoardManager();

// Switch to a different board
await switchBoard(boardId);

// Current board is automatically tracked
console.log('Current board:', currentBoard);
```

## Error Handling

### Database Initialization
```typescript
const { isInitialized, error, retryInitialization } = useDatabase();

if (error) {
  console.error('Database failed to initialize:', error);
  // Show error UI with retry option
  <ErrorDisplay error={error} onRetry={retryInitialization} />
}
```

### Migration Issues
```typescript
// Automatic retry logic in MigrationService
try {
  await MigrationService.migrateFromLocalStorage();
} catch (error) {
  console.error('Migration failed:', error);
  // Fallback to fresh database or retry
}
```

## Future Enhancements

### 1. Offline Support
- Service Worker integration
- Sync with cloud storage
- Conflict resolution

### 2. Search & Indexing
- Full-text search across items
- Tag-based filtering
- Advanced query builder

### 3. Performance Monitoring
- Query performance metrics
- Storage usage tracking
- Automatic cleanup

### 4. Data Export/Import
- JSON export for backup
- Board templates
- Bulk operations

## Testing

### Database Tests
```typescript
// Example test structure
describe('BoardService', () => {
  beforeEach(async () => {
    await db.clearAllData();
  });

  it('should create a new board', async () => {
    const board = await BoardService.createBoard({ name: 'Test Board' });
    expect(board.name).toBe('Test Board');
  });
});
```

### Migration Tests
```typescript
describe('MigrationService', () => {
  it('should migrate localStorage data', async () => {
    // Setup localStorage with test data
    // Run migration
    // Verify data in IndexedDB
  });
});
```

## Browser Compatibility

| Browser | IndexedDB Support | Blob Support | Notes |
|---------|------------------|--------------|-------|
| Chrome | Full | Full | Recommended |
| Firefox | Full | Full | Recommended |
| Safari | Full | Full | Good |
| Edge | Full | Full | Good |
| IE 11 | Partial | Limited | Not recommended |

## Security Considerations

1. **Data Privacy**: All data stored locally, no server transmission
2. **XSS Protection**: IndexedDB same-origin policy
3. **Data Integrity**: Transaction support prevents corruption
4. **Storage Limits**: Browser-controlled quotas

## Conclusion

The new IndexedDB-based database system provides Mero Canvas with:

- **Scalable storage** for images and large canvases
- **Multi-board support** for better organization
- **Fast performance** with indexed queries
- **Data persistence** across sessions
- **Migration path** from existing localStorage

This foundation enables future features like collaboration, syncing, and advanced search while maintaining the app's offline-first approach.