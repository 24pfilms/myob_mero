import { useState, useEffect, useCallback } from 'react';
import { BoardService } from '../src/db/services/BoardService';
import { ItemService } from '../src/db/services/ItemService';
import { BoardEntity } from '../src/db/types/database';
import { BoardItem, PanZoom } from '../types';

/**
 * Integrated hook that manages both board state and canvas operations
 * This replaces the localStorage-based approach with IndexedDB
 */
export const useBoardCanvas = () => {
  const [currentBoard, setCurrentBoard] = useState<BoardEntity | null>(null);
  const [items, setItems] = useState<BoardItem[]>([]);
  const [panZoom, setPanZoom] = useState<PanZoom>({ x: 0, y: 0, k: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load or create initial board
  useEffect(() => {
    const initializeBoard = async () => {
      try {
        setIsLoading(true);
        
        // Get app settings to check for current board
        const settings = await (await import('../src/db/Database')).db.appSettings.get(1);
        let board: BoardEntity | undefined;

        if (settings?.currentBoardId) {
          // Load the current board from settings
          board = await BoardService.getBoard(settings.currentBoardId);
        }

        if (!board) {
          // No current board - check if any boards exist
          const allBoards = await BoardService.getAllBoards();
          
          if (allBoards.length > 0) {
            // Use the most recently accessed board
            board = allBoards[0];
          } else {
            // No boards exist - create a default one
            board = await BoardService.createBoard({
              name: 'My First Board',
              description: 'Welcome to Mero!',
            });
          }

          // Set this as the current board
          if (settings) {
            await (await import('../src/db/Database')).db.appSettings.update(1, {
              currentBoardId: board.boardId,
            });
          }
        }

        // Load the board's items and settings
        const boardItems = await ItemService.getBoardItems(board.boardId);
        
        setCurrentBoard(board);
        setItems(boardItems);
        setPanZoom(board.panZoom);
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to initialize board:', err);
        setError(err instanceof Error ? err.message : 'Failed to load board');
        setIsLoading(false);
      }
    };

    initializeBoard();
  }, []);

  // Switch to a different board
  const switchBoard = useCallback(async (boardId: string) => {
    try {
      setIsLoading(true);
      
      const board = await BoardService.getBoard(boardId);
      if (!board) {
        throw new Error('Board not found');
      }

      const boardItems = await ItemService.getBoardItems(boardId);
      
      setCurrentBoard(board);
      setItems(boardItems);
      setPanZoom(board.panZoom);
      
      // Update app settings
      await (await import('../src/db/Database')).db.appSettings.update(1, {
        currentBoardId: boardId,
      });
      
      await BoardService.updateRecentlyUsed(boardId);
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to switch board:', err);
      setError(err instanceof Error ? err.message : 'Failed to switch board');
      setIsLoading(false);
    }
  }, []);

  // Add item to current board
  const addItem = useCallback(async (item: Omit<BoardItem, 'id'>) => {
    if (!currentBoard) return;

    try {
      const newItem = await ItemService.createItem(currentBoard.boardId, item);
      setItems(prev => [...prev, newItem]);
      
      // Update board's maxZIndex if needed
      if (item.zIndex > currentBoard.maxZIndex) {
        await BoardService.updateBoard(currentBoard.boardId, { maxZIndex: item.zIndex });
        setCurrentBoard(prev => prev ? { ...prev, maxZIndex: item.zIndex } : null);
      }
      
      return newItem;
    } catch (err) {
      console.error('Failed to add item:', err);
      throw err;
    }
  }, [currentBoard]);

  // Update item in current board
  const updateItem = useCallback(async (itemId: string, updates: Partial<BoardItem>) => {
    if (!currentBoard) return;

    try {
      await ItemService.updateItem(itemId, updates);
      setItems(prev => prev.map(item => 
        item.id === itemId ? { ...item, ...updates } : item
      ));
    } catch (err) {
      console.error('Failed to update item:', err);
      throw err;
    }
  }, [currentBoard]);

  // Update multiple items (for batch operations like changing colors)
  const updateItems = useCallback(async (updates: Array<{ itemId: string; updates: Partial<BoardItem> }>) => {
    if (!currentBoard) return;

    try {
      await ItemService.updateItems(updates);
      
      const updateMap = new Map(updates.map(u => [u.itemId, u.updates]));
      setItems(prev => prev.map(item => {
        const itemUpdates = updateMap.get(item.id);
        return itemUpdates ? { ...item, ...itemUpdates } : item;
      }));
    } catch (err) {
      console.error('Failed to update items:', err);
      throw err;
    }
  }, [currentBoard]);

  // Delete item from current board
  const deleteItem = useCallback(async (itemId: string) => {
    if (!currentBoard) return;

    try {
      await ItemService.deleteItem(itemId);
      setItems(prev => prev.filter(item => item.id !== itemId));
    } catch (err) {
      console.error('Failed to delete item:', err);
      throw err;
    }
  }, [currentBoard]);

  // Delete multiple items
  const deleteItems = useCallback(async (itemIds: string[]) => {
    if (!currentBoard) return;

    try {
      await ItemService.deleteItems(itemIds);
      const deletedSet = new Set(itemIds);
      setItems(prev => prev.filter(item => !deletedSet.has(item.id)));
    } catch (err) {
      console.error('Failed to delete items:', err);
      throw err;
    }
  }, [currentBoard]);

  // Update pan/zoom state and save to board
  const updatePanZoom = useCallback(async (newPanZoom: PanZoom) => {
    if (!currentBoard) return;

    setPanZoom(newPanZoom);
    
    // Debounce the database save
    try {
      await BoardService.updateBoard(currentBoard.boardId, { panZoom: newPanZoom });
    } catch (err) {
      console.error('Failed to update pan/zoom:', err);
    }
  }, [currentBoard]);

  // Set items directly (used by undo/redo)
  const setItemsDirectly = useCallback((newItems: BoardItem[]) => {
    setItems(newItems);
  }, []);

  return {
    // Board state
    currentBoard,
    items,
    panZoom,
    isLoading,
    error,
    
    // Board operations
    switchBoard,
    
    // Item operations
    addItem,
    updateItem,
    updateItems,
    deleteItem,
    deleteItems,
    setItems: setItemsDirectly,
    
    // View operations
    updatePanZoom,
    setPanZoom,
  };
};
