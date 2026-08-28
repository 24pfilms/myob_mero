# Database Integration Guide for Mero Canvas

## Quick Start

This guide shows how to integrate the new IndexedDB database system into Mero Canvas components.

## 1. Database Initialization

### Add to App.tsx

```tsx
import { useDatabase } from './hooks/useDatabase';

function App() {
  const { isInitialized, isMigrating, error } = useDatabase();

  if (isMigrating) {
    return <MigrationProgress />;
  }

  if (error) {
    return <DatabaseError error={error} />;
  }

  if (!isInitialized) {
    return <LoadingSpinner />;
  }

  // Rest of your app
  return <YourAppComponents />;
}
```

### Migration Progress Component

```tsx
const MigrationProgress = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="text-center">
      <div className="mb-4">Migrating your canvas data...</div>
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
    </div>
  </div>
);
```

## 2. Board Management Integration

### Replace Board Selection Logic

**Before (localStorage):**
```tsx
const [items, setItems] = useState([]);
const [panZoom, setPanZoom] = useState({ x: 0, y: 0, k: 1 });

// Load from localStorage
useEffect(() => {
  const saved = localStorage.getItem('infinite-canvas-board');
  if (saved) {
    const { items, panZoom } = JSON.parse(saved);
    setItems(items);
    setPanZoom(panZoom);
  }
}, []);
```

**After (Database):**
```tsx
import { useBoardManager } from './hooks/useBoardManager';

function CanvasApp() {
  const {
    currentBoard,
    currentItems,
    switchBoard,
    addItem,
    updateItem,
    deleteItem
  } = useBoardManager();

  switchBoard(boardId); // Load specific board
  
  return (
    <Board 
      items={currentItems}
      onAddItem={addItem}
      onUpdateItem={updateItem}
      onDeleteItem={deleteItem}
      // ... other props
    />
  );
}
```

## 3. Board Navigation Component

```tsx
import { BoardManager } from './components/BoardManager';

function MainLayout() {
  const [showBoardManager, setShowBoardManager] = useState(false);

  return (
    <div className="flex h-screen">
      {/* Board Manager Sidebar */}
      {showBoardManager && (
        <div className="w-64 bg-gray-800">
          <BoardManager />
        </div>
      )}
      
      {/* Main Canvas Area */}
      <div className="flex-1">
        <Toolbar 
          onToggleBoardManager={() => setShowBoardManager(!showBoardManager)}
        />
        <CanvasArea />
      </div>
    </div>
  );
}
```

## 4. Hook Migration Examples

### Replace useBoard with Database Version

**Current hook usage:**
```tsx
const {
  items,
  handleAddItem,
  handleUpdateItem,
  handleDeleteItem,
} = useBoard();
```

**New database hook usage:**
```tsx
const {
  currentItems,
  addItem,
  updateItem,
  deleteItem,
  currentBoard,
  switchBoard,
} = useBoardManager();
```

### Update Item Creation

**Before:**
```tsx
const handleAddItem = (type, options, x, y) => {
  const newItem = {
    id: `item_${Date.now()}`,
    type,
    x, y,
    ...options
  };
  setItems(prev => [...prev, newItem]);
};
```

**After:**
```tsx
const handleAddItem = async (type, options, x, y) => {
  const newItem = {
    type,
    x, y,
    ...options
  };
  await addItem(newItem); // Automatically saves to database
};
```

## 5. Toolbar Integration

### Add Board Management Buttons

```tsx
// In Toolbar.tsx
import { SparklesIcon } from './icons';

const Toolbar = ({ onToggleBoardManager, currentBoard }) => (
  <div className="toolbar">
    {/* Existing toolbar buttons */}
    
    {/* Board Management Section */}
    <div className="border-l border-gray-700 px-2">
      <button
        onClick={onToggleBoardManager}
        className="p-2 text-gray-300 hover:text-white"
        title="Manage Boards"
      >
        <SparklesIcon />
      </button>
    </div>
    
    {/* Current Board Display */}
    {currentBoard && (
      <div className="border-l border-gray-700 px-3 py-2">
        <div className="text-sm text-gray-400">Board:</div>
        <div className="text-white font-medium">{currentBoard.name}</div>
      </div>
    )}
  </div>
);
```

## 6. Context Menu Updates

### Add Board-Specific Actions

```tsx
// In ContextMenu.tsx
const ContextMenu = ({ data, currentBoardId, deleteItem, duplicateItem }) => (
  <div className="context-menu">
    {/* Existing menu items */}
    
    {/* Board-specific actions */}
    {currentBoardId && (
      <>
        <div className="border-t border-gray-700 my-1"></div>
        <button onClick={() => duplicateItem(data.itemIds)}>
          Duplicate
        </button>
        <button onClick={() => moveToBoard(data.itemIds)}>
          Move to Board...
        </button>
      </>
    )}
  </div>
);
```

## 7. Export/Import Integration

### Update Export Functions

```tsx
// In useBoard.ts or new service
import { ItemService } from '../db/services/ItemService';

const exportBoard = async (boardId: string) => {
  const items = await ItemService.getBoardItems(boardId);
  const exportData = {
    boardId,
    items,
    exportedAt: Date.now()
  };
  
  // Convert to JSON and download
  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: 'application/json'
  });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `board-${boardId}-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
};
```

## 8. Error Handling

### Database Error Boundaries

```tsx
import { useDatabase } from './hooks/useDatabase';

const DatabaseProvider = ({ children }) => {
  const { isInitialized, error, retryInitialization } = useDatabase();

  if (!isInitialized) {
    return <DatabaseLoading />;
  }

  if (error) {
    return (
      <DatabaseError 
        error={error}
        onRetry={retryInitialization}
        onReset={() => {
          localStorage.clear();
          window.location.reload();
        }}
      />
    );
  }

  return <>{children}</>;
};

// Wrap your app
<DatabaseProvider>
  <App />
</DatabaseProvider>
```

## 9. Performance Optimizations

### Lazy Loading Boards

```tsx
// Only load board data when needed
const useLazyBoard = (boardId: string) => {
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!boardId) return;

    const loadBoard = async () => {
      setLoading(true);
      try {
        const [boardData, itemsData] = await Promise.all([
          BoardService.getBoard(boardId),
          ItemService.getBoardItems(boardId)
        ]);
        setBoard({ ...boardData, items: itemsData });
      } catch (error) {
        console.error('Failed to load board:', error);
      } finally {
        setLoading(false);
      }
    };

    loadBoard();
  }, [boardId]);

  return { board, loading };
};
```

### Debounced Saves

```tsx
import { useCallback, useRef } from 'react';

const useDebouncedUpdate = (updateFunction, delay = 500) => {
  const timeoutRef = useRef(null);

  return useCallback((...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      updateFunction(...args);
    }, delay);
  }, [updateFunction, delay]);
};

// Usage
const debouncedUpdateItem = useDebouncedUpdate(updateItem);

// Call it frequently - will only save after 500ms of no changes
debouncedUpdateItem(itemId, updates);
```

## 10. Testing Integration

### Test Database Operations

```tsx
// __tests__/database.test.tsx
import { renderHook, act } from '@testing-library/react';
import { useDatabase } from '../hooks/useDatabase';

describe('useDatabase', () => {
  beforeEach(() => {
    // Clear database before each test
    indexedDB.deleteDatabase('mero-canvas');
  });

  test('initializes database', async () => {
    const { result } = renderHook(() => useDatabase());
    
    expect(result.current.isInitialized).toBe(false);
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });
    
    expect(result.current.isInitialized).toBe(true);
  });
});
```

## 11. Migration Steps

### Step-by-Step Migration

1. **Install Dependencies**
   ```bash
   npm install dexie
   ```

2. **Add Database Files**
   - `src/db/Database.ts` - Main database class
   - `src/db/types/database.ts` - Type definitions
   - `src/db/services/` - Service classes
   - `src/hooks/useDatabase.ts` - Initialization hook
   - `src/hooks/useBoardManager.ts` - Board management

3. **Update App.tsx**
   ```tsx
   import { useDatabase } from './hooks/useDatabase';

   function App() {
     const { isInitialized, error } = useDatabase();
     // ... rest of implementation
   }
   ```

4. **Replace useBoard Usage**
   - Find all `useBoard` imports
   - Replace with `useBoardManager`
   - Update function names (`handleAddItem` → `addItem`)

5. **Add Board UI Components**
   - Add `BoardManager` component
   - Add board navigation to toolbar
   - Add board switching functionality

6. **Test Migration**
   - Deploy to test environment
   - Verify localStorage data migrates correctly
   - Test new functionality

## 12. Troubleshooting

### Common Issues

**Migration stuck on loading:**
```tsx
// Check console for migration errors
// Use MigrationService.getMigrationInfo() to debug
```

**Items not persisting:**
```tsx
// Ensure async/await is used correctly
await addItem(item); // Must await
```

**Performance issues:**
```tsx
// Use indexed queries
items.where('boardId').equals(boardId).toArray()

// Batch operations
await db.transaction('rw', db.canvasItems, async () => {
  await Promise.all(operations);
});
```

**Database locked:**
```tsx
// Close previous connections
await db.close();
// Reopen
await db.open();
```

## 13. Best Practices

### Do's
- Use transactions for related operations
- Index foreign keys (`boardId`, `itemId`, `folderId`)
- Handle loading states gracefully
- Test migration thoroughly
- Use async/await consistently

### Don'ts
- Ignore async operations
- Store huge objects in single records
- Forget to handle database errors
- Mix localStorage and IndexedDB randomly
- Forget about browser storage limits

## 14. Future-Proofing

### Prepare for Sync Features
```tsx
// Add sync status to entities
interface CanvasItemEntity extends BaseCanvasItem {
  syncStatus: 'pending' | 'synced' | 'conflict';
  lastSynced?: number;
  version: number;
}
```

### Multi-user Considerations
```tsx
// Add ownership and sharing
interface BoardEntity extends BaseBoard {
  ownerId: string;
  collaborators: string[];
  isPublic: boolean;
}
```

This integration guide provides a complete roadmap for transitioning Mero Canvas from localStorage to the new IndexedDB database system.