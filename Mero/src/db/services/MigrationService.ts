import { db } from '../Database';
import { LocalStorageData, MigrationResult } from '../types/database';
import { BoardItem, PanZoom } from '../../../types';
import { MeroDatabase } from '../Database';

/**
 * Handles migration from localStorage to IndexedDB
 */
export class MigrationService {
  private static readonly LOCAL_STORAGE_KEY = 'infinite-canvas-board';
  private static readonly MIGRATION_FLAG_KEY = 'mero-migration-completed';

  /**
   * Check if migration has already been completed
   */
  static async hasMigrated(): Promise<boolean> {
    try {
      const migrated = localStorage.getItem(this.MIGRATION_FLAG_KEY);
      return migrated === 'true';
    } catch (error) {
      console.error('Error checking migration status:', error);
      return false;
    }
  }

  /**
   * Mark migration as completed
   */
  static setMigrationComplete(): void {
    try {
      localStorage.setItem(this.MIGRATION_FLAG_KEY, 'true');
    } catch (error) {
      console.error('Error setting migration flag:', error);
    }
  }

  /**
   * Load data from localStorage
   */
  static loadFromLocalStorage(): LocalStorageData | null {
    try {
      const savedState = localStorage.getItem(this.LOCAL_STORAGE_KEY);
      if (savedState) {
        const { items, panZoom } = JSON.parse(savedState);
        return { items: items || [], panZoom: panZoom || { x: 0, y: 0, k: 1 } };
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
    }
    return null;
  }

  /**
   * Migrate data from localStorage to IndexedDB
   */
  static async migrateFromLocalStorage(): Promise<MigrationResult> {
    console.log('🔄 Starting migration from localStorage to IndexedDB...');
    
    try {
      // Check if already migrated
      if (await this.hasMigrated()) {
        return {
          success: true,
          message: 'Already migrated',
          migratedItems: 0,
          migratedImages: 0
        };
      }

      // Load data from localStorage
      const localStorageData = this.loadFromLocalStorage();
      if (!localStorageData || localStorageData.items.length === 0) {
        console.log('📭 No data found in localStorage to migrate');
        this.setMigrationComplete();
        return {
          success: true,
          message: 'No data to migrate',
          migratedItems: 0,
          migratedImages: 0
        };
      }

      console.log(`📦 Found ${localStorageData.items.length} items to migrate`);

      // Initialize database
      await db.transaction('rw', db.folders, db.boards, db.appSettings, async () => {
        await db.initializeDefaultSettings();
        await db.createDefaultFolders();
      });

      // Create a default board for migrated items
      const boardId = MeroDatabase.generateId();
      const now = Date.now();
      
      await db.boards.add({
        boardId,
        folderId: 'root', // Put in root folder
        name: 'Migrated Board',
        description: 'Migrated from localStorage',
        maxZIndex: Math.max(...localStorageData.items.map(item => item.zIndex), 0),
        panZoom: localStorageData.panZoom,
        createdAt: now,
        updatedAt: now,
        lastAccessedAt: now,
      });

      // Migrate items and collect image data
      const imageDataToMigrate: Array<{
        item: BoardItem;
        imageType: 'src' | 'generatedImageUrl' | 'generatedVideoUrl';
        dataUrl: string;
      }> = [];

      let migratedItems = 0;
      const itemsToMigrate = localStorageData.items.map(item => {
        const itemEntity = this.convertBoardItemToEntity(item, boardId);
        
        // Collect image data URLs for separate migration
        if (item.src) {
          imageDataToMigrate.push({
            item,
            imageType: 'src',
            dataUrl: item.src
          });
        }
        if (item.generatedImageUrl) {
          imageDataToMigrate.push({
            item,
            imageType: 'generatedImageUrl',
            dataUrl: item.generatedImageUrl
          });
        }
        if (item.generatedVideoUrl) {
          imageDataToMigrate.push({
            item,
            imageType: 'generatedVideoUrl',
            dataUrl: item.generatedVideoUrl
          });
        }
        
        return itemEntity;
      });

      // Migrate items to database
      await db.transaction('rw', db.canvasItems, async () => {
        for (const item of itemsToMigrate) {
          await db.canvasItems.add(item);
          migratedItems++;
        }
      });

      // Migrate image data
      let migratedImages = 0;
      for (const imageData of imageDataToMigrate) {
        try {
          const imageId = MeroDatabase.generateId();
          const blob = await this.dataUrlToBlob(imageData.dataUrl);
          
          await db.imageData.add({
            imageId,
            itemId: imageData.item.id,
            boardId,
            type: imageData.imageType,
            data: blob,
            fileName: `image_${imageData.item.id}_${imageData.imageType}`,
            mimeType: blob.type,
            size: blob.size,
            createdAt: now
          });
          
          migratedImages++;
        } catch (error) {
          console.error(`Failed to migrate image for item ${imageData.item.id}:`, error);
        }
      }

      // Update app settings to set current board
      await db.appSettings.update(1, { 
        currentBoardId: boardId,
        recentlyUsedBoards: [boardId],
        updatedAt: now
      });

      // Mark migration as complete
      this.setMigrationComplete();

      console.log(`✅ Migration completed: ${migratedItems} items, ${migratedImages} images`);

      // Optional: Clear localStorage to free up space
      // localStorage.removeItem(this.LOCAL_STORAGE_KEY);

      return {
        success: true,
        message: `Successfully migrated ${migratedItems} items and ${migratedImages} images`,
        migratedItems,
        migratedImages
      };

    } catch (error) {
      console.error('❌ Migration failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown migration error',
        migratedItems: 0,
        migratedImages: 0
      };
    }
  }

  /**
   * Convert BoardItem to CanvasItemEntity
   */
  private static convertBoardItemToEntity(item: BoardItem, boardId: string) {
    const now = Date.now();
    const { src, generatedImageUrl, generatedVideoUrl, id, ...rest } = item;
    
    return {
      itemId: id, // Map id to itemId
      ...rest,
      boardId,
      createdAt: now,
      updatedAt: now
    };
  }

  /**
   * Convert data URL to Blob
   */
  private static dataUrlToBlob(dataUrl: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
      try {
        const response = fetch(dataUrl);
        response.then(res => res.blob()).then(resolve).catch(reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get migration status info
   */
  static async getMigrationInfo(): Promise<{
    hasMigrated: boolean;
    localStorageData: LocalStorageData | null;
    databaseInfo: any;
  }> {
    const hasMigrated = await this.hasMigrated();
    const localStorageData = this.loadFromLocalStorage();
    const databaseInfo = await db.getDatabaseInfo();

    return {
      hasMigrated,
      localStorageData,
      databaseInfo
    };
  }
}