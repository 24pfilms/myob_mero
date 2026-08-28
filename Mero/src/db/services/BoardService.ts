import { db } from '../Database';
import { BoardEntity } from '../types/database';
import { BoardItem, PanZoom } from '../../../types';
import { MeroDatabase } from '../Database';

export interface CreateBoardOptions {
  name: string;
  description?: string;
  folderId?: string;
}

export interface UpdateBoardOptions {
  name?: string;
  description?: string;
  folderId?: string;
  maxZIndex?: number;
  backgroundColor?: string;
  dotDensity?: number;
  toolbarPosition?: 'top' | 'left' | 'bottom' | 'right';
  panZoom?: PanZoom;
}

/**
 * Service for board operations
 */
export class BoardService {
  /**
   * Create a new board
   */
  static async createBoard(options: CreateBoardOptions): Promise<BoardEntity> {
    const now = Date.now();
    const boardId = MeroDatabase.generateId();
    
    const board: BoardEntity = {
      boardId,
      name: options.name,
      description: options.description,
      folderId: options.folderId || 'root',
      maxZIndex: 0,
      panZoom: { x: 0, y: 0, k: 1 },
      backgroundColor: '#111827',
      dotDensity: 20,
      toolbarPosition: 'top',
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now,
    };

    await db.boards.add(board);
    return board;
  }

  /**
   * Get all boards
   */
  static async getAllBoards(): Promise<BoardEntity[]> {
    return await db.boards.orderBy('updatedAt').reverse().toArray();
  }

  /**
   * Get boards by folder
   */
  static async getBoardsByFolder(folderId?: string): Promise<BoardEntity[]> {
    if (folderId === undefined) {
      // Get boards without folder (root level)
      return await db.boards.where('folderId').equals('').toArray();
    }
    return await db.boards.where('folderId').equals(folderId).toArray();
  }

  /**
   * Get a single board by ID
   */
  static async getBoard(boardId: string): Promise<BoardEntity | undefined> {
    return await db.boards.where('boardId').equals(boardId).first();
  }

  /**
   * Update a board
   */
  static async updateBoard(boardId: string, updates: UpdateBoardOptions): Promise<boolean> {
    const board = await this.getBoard(boardId);
    if (!board) return false;

    await db.boards.where('boardId').equals(boardId).modify((board) => {
      Object.assign(board, updates, { updatedAt: Date.now(), lastAccessedAt: Date.now() });
    });

    return true;
  }

  /**
   * Delete a board and all its items
   */
  static async deleteBoard(boardId: string): Promise<boolean> {
    const board = await this.getBoard(boardId);
    if (!board) return false;

    await db.transaction('rw', db.boards, db.canvasItems, db.imageData, async () => {
      // Delete the board
      await db.boards.where('boardId').equals(boardId).delete();
      
      // Get all items in this board
      const items = await db.canvasItems.where('boardId').equals(boardId).toArray();
      const itemIds = items.map(item => item.itemId);
      
      // Delete image data for these items
      await db.imageData.where('itemId').anyOf(itemIds).delete();
      
      // Delete the items
      await db.canvasItems.where('boardId').equals(boardId).delete();
    });

    return true;
  }

  /**
   * Duplicate a board
   */
  static async duplicateBoard(boardId: string, newName?: string): Promise<BoardEntity | null> {
    const originalBoard = await this.getBoard(boardId);
    if (!originalBoard) return null;

    // Create new board
    const newBoard = await this.createBoard({
      name: newName || `${originalBoard.name} (Copy)`,
      description: originalBoard.description,
      folderId: originalBoard.folderId,
    });

    // Copy board settings
    await this.updateBoard(newBoard.boardId, {
      maxZIndex: originalBoard.maxZIndex,
      backgroundColor: originalBoard.backgroundColor,
      dotDensity: originalBoard.dotDensity,
      toolbarPosition: originalBoard.toolbarPosition,
      panZoom: originalBoard.panZoom
    });

    // Copy all items
    const originalItems = await db.canvasItems.where('boardId').equals(boardId).toArray();
    
    for (const originalItem of originalItems) {
      const { id, itemId, ...itemData } = originalItem;
      const newItemId = MeroDatabase.generateId();
      
      await db.canvasItems.add({
        ...itemData,
        itemId: newItemId,
        boardId: newBoard.boardId,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      // Copy associated image data
      const originalImageData = await db.imageData.where('itemId').equals(originalItem.itemId).toArray();
      for (const imageData of originalImageData) {
        const { id: imgId, imageId: originalImageId, ...imageDataRest } = imageData;
        await db.imageData.add({
          ...imageDataRest,
          imageId: MeroDatabase.generateId(),
          itemId: newItemId,
          boardId: newBoard.boardId,
          createdAt: Date.now()
        });
      }
    }

    return newBoard;
  }

  /**
   * Get recently used boards
   */
  static async getRecentBoards(limit: number = 5): Promise<BoardEntity[]> {
    const settings = await db.appSettings.get(1);
    if (!settings || !settings.recentlyUsedBoards.length) return [];

    const recentBoardIds = settings.recentlyUsedBoards.slice(0, limit);
    return await db.boards.where('boardId').anyOf(recentBoardIds).toArray();
  }

  /**
   * Update recently used boards
   */
  static async updateRecentlyUsed(boardId: string): Promise<void> {
    const settings = await db.appSettings.get(1);
    if (!settings) return;

    const recentlyUsed = settings.recentlyUsedBoards.filter(id => id !== boardId);
    recentlyUsed.unshift(boardId);
    
    // Keep only the 10 most recent
    const limitedRecent = recentlyUsed.slice(0, 10);

    await db.appSettings.update(1, {
      recentlyUsedBoards: limitedRecent,
      currentBoardId: boardId,
      updatedAt: Date.now()
    });
  }

  /**
   * Search boards by name or description
   */
  static async searchBoards(query: string): Promise<BoardEntity[]> {
    if (!query.trim()) return this.getAllBoards();
    
    const lowerQuery = query.toLowerCase();
    return await db.boards
      .toCollection()
      .filter(board => 
        board.name.toLowerCase().includes(lowerQuery) || 
        (board.description && board.description.toLowerCase().includes(lowerQuery))
      )
      .toArray();
  }

  /**
   * Move board to another folder
   */
  static async moveBoard(boardId: string, targetFolderId?: string): Promise<boolean> {
    return await this.updateBoard(boardId, { folderId: targetFolderId });
  }

  /**
   * Get board statistics
   */
  static async getBoardStats(boardId: string): Promise<{
    itemCount: number;
    imageCount: number;
    totalSize: number;
    lastModified: number;
  }> {
    const items = await db.canvasItems.where('boardId').equals(boardId).toArray();
    const itemIds = items.map(item => item.itemId);
    const imageData = await db.imageData.where('itemId').anyOf(itemIds).toArray();
    
    return {
      itemCount: items.length,
      imageCount: imageData.length,
      totalSize: imageData.reduce((sum, img) => sum + img.size, 0),
      lastModified: Math.max(...items.map(item => item.updatedAt), 0)
    };
  }
}