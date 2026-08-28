import { useState, useEffect, useCallback } from 'react';
import { BoardService } from '../src/db/services/BoardService';
import { FolderService } from '../src/db/services/FolderService';
import { ItemService } from '../src/db/services/ItemService';
import { BoardEntity, FolderEntity } from '../src/db/types/database';
import { BoardItem, PanZoom } from '../types';
import { api } from '../services/api';

const CURRENT_BOARD_STORAGE_KEY = 'mero-current-board-id';
const DEFAULT_CANVAS_BG = '#111827';
const DEFAULT_DOT_DENSITY = 20;

const mapRemoteBoard = (b: {
  board_id: string;
  name: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
}): BoardEntity => {
  const createdAt = Date.parse(b.created_at);
  const updatedAt = Date.parse(b.updated_at);
  return {
    boardId: b.board_id,
    name: b.name,
    description: b.description ?? undefined,
    folderId: 'root',
    maxZIndex: 0,
    panZoom: { x: 0, y: 0, k: 1 },
    backgroundColor: DEFAULT_CANVAS_BG,
    dotDensity: DEFAULT_DOT_DENSITY,
    toolbarPosition: 'top',
    createdAt: isNaN(createdAt) ? Date.now() : createdAt,
    updatedAt: isNaN(updatedAt) ? Date.now() : updatedAt,
    lastAccessedAt: isNaN(updatedAt) ? Date.now() : updatedAt,
  };
};

export interface BoardState {
  boards: BoardEntity[];
  folders: FolderEntity[];
  currentBoard: BoardEntity | null;
  currentItems: BoardItem[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook for managing multiple boards and folders
 */
export const useBoardManager = () => {
  const [state, setState] = useState<BoardState>({
    boards: [],
    folders: [],
    currentBoard: null,
    currentItems: [],
    isLoading: true,
    error: null,
  });

  // Load all boards and folders
  const loadData = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      if (api.isAuthenticated()) {
        const remote = await api.getBoards();
        const boards = remote.boards.map(mapRemoteBoard);
        const currentId = localStorage.getItem(CURRENT_BOARD_STORAGE_KEY);
        const currentBoard = currentId ? boards.find(b => b.boardId === currentId) || null : null;

        setState(prev => ({
          ...prev,
          boards,
          folders: [],
          currentBoard,
          currentItems: [],
          isLoading: false,
        }));
      } else {
        const [boards, folders] = await Promise.all([
          BoardService.getAllBoards(),
          FolderService.getAllFolders(),
        ]);

        setState(prev => ({
          ...prev,
          boards,
          folders,
          isLoading: false,
        }));
      }
    } catch (error) {
      console.error('Failed to load board data:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, []);

  // Load items for current board
  const loadCurrentBoardItems = useCallback(async (boardId: string) => {
    try {
      if (api.isAuthenticated()) {
        // In API mode, board/items are loaded by useBoard; we only track active board id.
        localStorage.setItem(CURRENT_BOARD_STORAGE_KEY, boardId);
        setState(prev => ({
          ...prev,
          currentBoard: prev.boards.find(b => b.boardId === boardId) || prev.currentBoard,
          currentItems: [],
        }));
      } else {
        const [board, items] = await Promise.all([
          BoardService.getBoard(boardId),
          ItemService.getBoardItems(boardId),
        ]);

        if (board) {
          await BoardService.updateRecentlyUsed(boardId);
          
          setState(prev => ({
            ...prev,
            currentBoard: board,
            currentItems: items,
          }));
        }
      }
    } catch (error) {
      console.error('Failed to load board items:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, []);

  // Create a new board
  const createBoard = useCallback(async (options: { name: string; description?: string; folderId?: string }) => {
    try {
      if (api.isAuthenticated()) {
        const created = await api.createBoard(options.name, options.description);
        const board = mapRemoteBoard(created);
        setState(prev => ({
          ...prev,
          boards: [board, ...prev.boards],
        }));
        return board;
      } else {
        const board = await BoardService.createBoard(options);
        setState(prev => ({
          ...prev,
          boards: [board, ...prev.boards],
        }));
        return board;
      }
    } catch (error) {
      console.error('Failed to create board:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
      throw error;
    }
  }, []);

  // Create a new folder
  const createFolder = useCallback(async (options: { name: string; parentId?: string }) => {
    try {
      const folder = await FolderService.createFolder(options);
      setState(prev => ({
        ...prev,
        folders: [...prev.folders, folder],
      }));
      return folder;
    } catch (error) {
      console.error('Failed to create folder:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
      throw error;
    }
  }, []);

  // Switch to a different board
  const switchBoard = useCallback(async (boardId: string) => {
    await loadCurrentBoardItems(boardId);
    // Update app settings to set this as the current board
    try {
      if (api.isAuthenticated()) {
        localStorage.setItem(CURRENT_BOARD_STORAGE_KEY, boardId);
      } else {
        const { db } = await import('../src/db/Database');
        await db.appSettings.update(1, { 
          currentBoardId: boardId,
          updatedAt: Date.now()
        });
        console.log('✅ Switched to board:', boardId);
      }
    } catch (error) {
      console.error('Failed to update current board in settings:', error);
    }
  }, [loadCurrentBoardItems]);

  // Update current board
  const updateCurrentBoard = useCallback(async (updates: {
    name?: string;
    description?: string;
    panZoom?: PanZoom;
    maxZIndex?: number;
  }) => {
    if (!state.currentBoard) return;

    try {
      await BoardService.updateBoard(state.currentBoard.boardId, updates);
      
      const updatedBoard = { ...state.currentBoard, ...updates, updatedAt: Date.now() };
      setState(prev => ({
        ...prev,
        currentBoard: updatedBoard,
        boards: prev.boards.map(b => 
          b.boardId === updatedBoard.boardId ? updatedBoard : b
        ),
      }));
    } catch (error) {
      console.error('Failed to update board:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, [state.currentBoard]);

  // Delete current board
  const deleteCurrentBoard = useCallback(async () => {
    if (!state.currentBoard) return;

    try {
      await BoardService.deleteBoard(state.currentBoard.boardId);
      
      setState(prev => ({
        ...prev,
        currentBoard: null,
        currentItems: [],
        boards: prev.boards.filter(b => b.boardId !== state.currentBoard?.boardId),
      }));
    } catch (error) {
      console.error('Failed to delete board:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, [state.currentBoard]);

  // Delete any board by ID
  const deleteBoard = useCallback(async (boardId: string) => {
    try {
      if (api.isAuthenticated()) {
        await api.deleteBoard(boardId);
      } else {
        await BoardService.deleteBoard(boardId);
      }
      
      setState(prev => ({
        ...prev,
        currentBoard: prev.currentBoard?.boardId === boardId ? null : prev.currentBoard,
        currentItems: prev.currentBoard?.boardId === boardId ? [] : prev.currentItems,
        boards: prev.boards.filter(b => b.boardId !== boardId),
      }));
      
      console.log('✅ Deleted board:', boardId);
    } catch (error) {
      console.error('Failed to delete board:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
      throw error;
    }
  }, []);

  // Add item to current board
  const addItem = useCallback(async (item: Omit<BoardItem, 'id'>) => {
    if (!state.currentBoard) return;

    try {
      const newItem = await ItemService.createItem(state.currentBoard.boardId, item);
      
      setState(prev => ({
        ...prev,
        currentItems: [...prev.currentItems, newItem],
      }));
      
      // Update maxZIndex if needed
      if (item.zIndex > (state.currentBoard.maxZIndex || 0)) {
        await updateCurrentBoard({ maxZIndex: item.zIndex });
      }
      
      return newItem;
    } catch (error) {
      console.error('Failed to add item:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
      throw error;
    }
  }, [state.currentBoard, updateCurrentBoard]);

  // Update item in current board
  const updateItem = useCallback(async (itemId: string, updates: Partial<BoardItem>) => {
    try {
      await ItemService.updateItem(itemId, updates);
      
      setState(prev => ({
        ...prev,
        currentItems: prev.currentItems.map(item => 
          item.id === itemId ? { ...item, ...updates } : item
        ),
      }));
    } catch (error) {
      console.error('Failed to update item:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, []);

  // Delete item from current board
  const deleteItem = useCallback(async (itemId: string) => {
    try {
      await ItemService.deleteItem(itemId);
      
      setState(prev => ({
        ...prev,
        currentItems: prev.currentItems.filter(item => item.id !== itemId),
      }));
    } catch (error) {
      console.error('Failed to delete item:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, []);

  // Get boards in a folder
  const getBoardsInFolder = useCallback(async (folderId?: string) => {
    try {
      return await BoardService.getBoardsByFolder(folderId);
    } catch (error) {
      console.error('Failed to get boards in folder:', error);
      return [];
    }
  }, []);

  // Move board to folder
  const moveBoardToFolder = useCallback(async (boardId: string, folderId?: string) => {
    try {
      const success = await BoardService.moveBoard(boardId, folderId);
      if (success) {
        setState(prev => ({
          ...prev,
          boards: prev.boards.map(board => 
            board.boardId === boardId ? { ...board, folderId } : board
          ),
        }));
      }
      return success;
    } catch (error) {
      console.error('Failed to move board:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
      return false;
    }
  }, []);

  // Initialize data on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    ...state,
    // Actions
    loadData,
    switchBoard,
    createBoard,
    createFolder,
    updateCurrentBoard,
    deleteCurrentBoard,
    deleteBoard,
    addItem,
    updateItem,
    deleteItem,
    getBoardsInFolder,
    moveBoardToFolder,
    // Refresh data
    refreshBoards: loadData,
    refreshCurrentItems: () => state.currentBoard && loadCurrentBoardItems(state.currentBoard.boardId),
  };
};