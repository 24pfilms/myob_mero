import { db } from '../Database';
import { CanvasItemEntity, ImageDataEntity } from '../types/database';
import { BoardItem, ItemType } from '../../../types';
import { MeroDatabase } from '../Database';

/**
 * Service for canvas item operations
 */
export class ItemService {
  /**
   * Get all items for a board
   */
  static async getBoardItems(boardId: string): Promise<BoardItem[]> {
    const canvasItems = await db.canvasItems
      .where('boardId')
      .equals(boardId)
      .toArray();

    // Convert entities back to BoardItem format and add image data
    const boardItems: BoardItem[] = [];
    
    for (const canvasItem of canvasItems) {
      const { id, itemId, boardId: _, createdAt, updatedAt, ...itemData } = canvasItem;
      
      // Get associated image data
      const imageData = await this.getItemImageData(itemId);
      
      // Add image data to the item
      const boardItem: BoardItem = {
        ...itemData,
        id: itemId,
        ...(imageData.src && { src: imageData.src }),
        ...(imageData.generatedImageUrl && { generatedImageUrl: imageData.generatedImageUrl }),
        ...(imageData.generatedVideoUrl && { generatedVideoUrl: imageData.generatedVideoUrl }),
      };
      
      boardItems.push(boardItem);
    }

    // Sort by z-index
    return boardItems.sort((a, b) => a.zIndex - b.zIndex);
  }

  /**
   * Get a single item by ID
   */
  static async getItem(itemId: string): Promise<BoardItem | undefined> {
    const canvasItem = await db.canvasItems.where('itemId').equals(itemId).first();
    if (!canvasItem) return undefined;

    const { id, itemId: canvasItemId, boardId, createdAt, updatedAt, ...itemData } = canvasItem;
    
    // Get associated image data
    const imageData = await this.getItemImageData(itemId);
    
    // Add image data to the item
    return {
      ...itemData,
      id: canvasItemId,
      ...(imageData.src && { src: imageData.src }),
      ...(imageData.generatedImageUrl && { generatedImageUrl: imageData.generatedImageUrl }),
      ...(imageData.generatedVideoUrl && { generatedVideoUrl: imageData.generatedVideoUrl }),
    };
  }

  /**
   * Create a new item
   */
  static async createItem(boardId: string, item: Omit<BoardItem, 'id'>): Promise<BoardItem> {
    const itemId = MeroDatabase.generateId();
    const now = Date.now();
    
    const { src, generatedImageUrl, generatedVideoUrl, ...itemData } = item;
    
    // Create the canvas item entity
    const canvasItem: CanvasItemEntity = {
      itemId,
      boardId,
      ...itemData,
      createdAt: now,
      updatedAt: now,
    };

    await db.canvasItems.add(canvasItem);

    // Store image data if present
    if (src) {
      await this.storeImageData(itemId, boardId, 'src', src);
    }
    if (generatedImageUrl) {
      await this.storeImageData(itemId, boardId, 'generatedImageUrl', generatedImageUrl);
    }
    if (generatedVideoUrl) {
      await this.storeImageData(itemId, boardId, 'generatedVideoUrl', generatedVideoUrl);
    }

    return { ...item, id: itemId };
  }

  /**
   * Update an item
   */
  static async updateItem(itemId: string, updates: Partial<BoardItem>): Promise<boolean> {
    const existingItem = await db.canvasItems.where('itemId').equals(itemId).first();
    if (!existingItem) return false;

    const { src, generatedImageUrl, generatedVideoUrl, ...itemData } = updates;

    // Update the canvas item
    await db.canvasItems.where('itemId').equals(itemId).modify((item) => {
      Object.assign(item, itemData, { updatedAt: Date.now() });
    });

    // Update image data if provided
    if (src !== undefined) {
      await this.storeImageData(itemId, existingItem.boardId, 'src', src);
    }
    if (generatedImageUrl !== undefined) {
      await this.storeImageData(itemId, existingItem.boardId, 'generatedImageUrl', generatedImageUrl);
    }
    if (generatedVideoUrl !== undefined) {
      await this.storeImageData(itemId, existingItem.boardId, 'generatedVideoUrl', generatedVideoUrl);
    }

    return true;
  }

  /**
   * Delete an item
   */
  static async deleteItem(itemId: string): Promise<boolean> {
    const existingItem = await db.canvasItems.where('itemId').equals(itemId).first();
    if (!existingItem) return false;

    await db.transaction('rw', db.canvasItems, db.imageData, async () => {
      // Delete the item
      await db.canvasItems.where('itemId').equals(itemId).delete();
      
      // Delete associated image data
      await db.imageData.where('itemId').equals(itemId).delete();
    });

    return true;
  }

  /**
   * Delete multiple items
   */
  static async deleteItems(itemIds: string[]): Promise<number> {
    await db.transaction('rw', db.canvasItems, db.imageData, async () => {
      // Delete the items
      await db.canvasItems.where('itemId').anyOf(itemIds).delete();
      
      // Delete associated image data
      await db.imageData.where('itemId').anyOf(itemIds).delete();
    });

    return itemIds.length;
  }

  /**
   * Get all items of a specific type for a board
   */
  static async getItemsByType(boardId: string, itemType: ItemType): Promise<BoardItem[]> {
    const items = await this.getBoardItems(boardId);
    return items.filter(item => item.type === itemType);
  }

  /**
   * Search items by text content
   */
  static async searchItems(boardId: string, query: string): Promise<BoardItem[]> {
    if (!query.trim()) return this.getBoardItems(boardId);
    
    const lowerQuery = query.toLowerCase();
    const canvasItems = await db.canvasItems
      .where('boardId')
      .equals(boardId)
      .toArray();

    const filteredItems = canvasItems.filter(item => 
      item.text.toLowerCase().includes(lowerQuery)
    );

    // Convert back to BoardItem format with image data
    const boardItems: BoardItem[] = [];
    
    for (const canvasItem of filteredItems) {
      const { id, itemId: canvasItemId, boardId, createdAt, updatedAt, ...itemData } = canvasItem;
      
      const imageData = await this.getItemImageData(canvasItemId);
      
      const boardItem: BoardItem = {
        ...itemData,
        id: canvasItemId,
        ...(imageData.src && { src: imageData.src }),
        ...(imageData.generatedImageUrl && { generatedImageUrl: imageData.generatedImageUrl }),
        ...(imageData.generatedVideoUrl && { generatedVideoUrl: imageData.generatedVideoUrl }),
      };
      
      boardItems.push(boardItem);
    }

    return boardItems.sort((a, b) => a.zIndex - b.zIndex);
  }

  /**
   * Store image data in IndexedDB
   */
  private static async storeImageData(
    itemId: string, 
    boardId: string, 
    type: 'src' | 'generatedImageUrl' | 'generatedVideoUrl', 
    dataUrl: string
  ): Promise<void> {
    try {
      // Remove existing image data of the same type
      await db.imageData.where('itemId').equals(itemId).and(img => img.type === type).delete();

      // Convert data URL to blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      
      const imageData: ImageDataEntity = {
        imageId: MeroDatabase.generateId(),
        itemId,
        boardId,
        type,
        data: blob,
        fileName: `image_${itemId}_${type}`,
        mimeType: blob.type,
        size: blob.size,
        createdAt: Date.now(),
      };

      await db.imageData.add(imageData);
    } catch (error) {
      console.error(`Failed to store image data for item ${itemId}:`, error);
    }
  }

  /**
   * Get all image data for an item
   */
  private static async getItemImageData(itemId: string): Promise<{
    src?: string;
    generatedImageUrl?: string;
    generatedVideoUrl?: string;
  }> {
    const imageData = await db.imageData.where('itemId').equals(itemId).toArray();
    
    const result: any = {};
    
    for (const image of imageData) {
      try {
        const dataUrl = await this.blobToDataUrl(image.data);
        result[image.type] = dataUrl;
      } catch (error) {
        console.error(`Failed to convert blob to data URL for ${image.type}:`, error);
      }
    }
    
    return result;
  }

  /**
   * Convert blob to data URL
   */
  private static blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Get the maximum z-index for a board
   */
  static async getMaxZIndex(boardId: string): Promise<number> {
    const items = await db.canvasItems.where('boardId').equals(boardId).toArray();
    if (items.length === 0) return 0;
    return Math.max(...items.map(item => item.zIndex));
  }

  /**
   * Update multiple items in a batch
   */
  static async updateItems(
    updates: Array<{ itemId: string; updates: Partial<BoardItem> }>
  ): Promise<number> {
    let updatedCount = 0;
    
    await db.transaction('rw', db.canvasItems, db.imageData, async () => {
      for (const { itemId, updates: itemUpdates } of updates) {
        const success = await this.updateItem(itemId, itemUpdates);
        if (success) updatedCount++;
      }
    });

    return updatedCount;
  }

  /**
   * Get items count by type for a board
   */
  static async getItemStats(boardId: string): Promise<Record<ItemType, number>> {
    const items = await db.canvasItems.where('boardId').equals(boardId).toArray();
    const stats = {} as Record<ItemType, number>;
    
    // Initialize stats for all item types
    Object.values(ItemType).forEach(type => {
      stats[type] = 0;
    });
    
    // Count items by type
    items.forEach(item => {
      stats[item.type]++;
    });
    
    return stats;
  }
}