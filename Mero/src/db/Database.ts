import Dexie, { Table } from 'dexie';
import { 
  FolderEntity, 
  BoardEntity, 
  CanvasItemEntity, 
  ImageDataEntity, 
  AppSettingsEntity,
  DATABASE_VERSION,
  DATABASE_NAME 
} from './types/database';

/**
 * Main database class for Mero Canvas
 * Handles all IndexedDB operations using Dexie.js
 */
export class MeroDatabase extends Dexie {
  // Tables
  folders!: Table<FolderEntity>;
  boards!: Table<BoardEntity>;
  canvasItems!: Table<CanvasItemEntity>;
  imageData!: Table<ImageDataEntity>;
  appSettings!: Table<AppSettingsEntity>;

  constructor() {
    super(DATABASE_NAME);
    this.setupSchema();
  }

  /**
   * Setup database schema with versioning
   */
  private setupSchema() {
    // Version 1: Initial schema (for future migrations)
    this.version(1).stores({
      // Empty for now - will migrate from localStorage
    });

    // Version 2: Multi-board support with folders
    this.version(2).stores({
      folders: '++id, folderId, parentId, name, createdAt, updatedAt',
      boards: '++id, boardId, folderId, name, updatedAt, lastAccessedAt',
      canvasItems: '++id, itemId, boardId, type, zIndex, updatedAt',
      imageData: '++id, imageId, itemId, boardId, type, size, createdAt',
      appSettings: '++id, updatedAt'
    });

    // Add hooks for timestamps
    this.folders.hook('creating', this.addCreatedAt);
    this.folders.hook('updating', this.addUpdatedAt);
    this.boards.hook('creating', this.addCreatedAt);
    this.boards.hook('updating', this.addUpdatedAt);
    this.boards.hook('creating', this.addLastAccessedAt);
    this.boards.hook('updating', this.addLastAccessedAt);
    this.canvasItems.hook('creating', this.addCreatedAt);
    this.canvasItems.hook('updating', this.addUpdatedAt);
    this.imageData.hook('creating', this.addCreatedAt);
    this.appSettings.hook('creating', this.addCreatedAt);
    this.appSettings.hook('updating', this.addUpdatedAt);
  }

  /**
   * Hook to add createdAt timestamp
   */
  private addCreatedAt(primKey: any, obj: any, trans: any) {
    if (obj && typeof obj === 'object' && !obj.createdAt) {
      obj.createdAt = Date.now();
    }
  }

  /**
   * Hook to add updatedAt timestamp
   */
  private addUpdatedAt(modifications: any) {
    // For updating hook, modifications is the object being modified
    if (modifications && typeof modifications === 'object') {
      modifications.updatedAt = Date.now();
    }
    return modifications;
  }

  /**
   * Hook to add lastAccessedAt timestamp for boards
   */
  private addLastAccessedAt(primKey: any, obj: any, trans: any) {
    if (obj && typeof obj === 'object') {
      obj.lastAccessedAt = Date.now();
    }
  }

  /**
   * Initialize default app settings
   */
  async initializeDefaultSettings(): Promise<void> {
    const existingSettings = await this.appSettings.get(1);
    if (!existingSettings) {
      const now = Date.now();
      await this.appSettings.add({
        id: 1,
        sidebarWidth: 250,
        theme: 'dark',
        autoSave: true,
        autoSaveInterval: 30, // 30 seconds
        recentlyUsedBoards: [],
        updatedAt: now,
      });
    }
  }

  /**
   * Create default folder structure
   */
  async createDefaultFolders(): Promise<void> {
    const existingFolders = await this.folders.count();
    if (existingFolders === 0) {
      const now = Date.now();
      // Create root "My Boards" folder
      await this.folders.add({
        folderId: 'root',
        name: 'My Boards',
        isExpanded: true,
        createdAt: now,
        updatedAt: now,
      });

      // Create "Archived" folder
      await this.folders.add({
        folderId: 'archived',
        name: 'Archived',
        isExpanded: false,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  /**
   * Generate a unique ID for entities
   */
  static generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear all data (for testing/reset purposes)
   */
  async clearAllData(): Promise<void> {
    await this.transaction('rw', [this.folders, this.boards, this.canvasItems, this.imageData, this.appSettings], async () => {
      await this.folders.clear();
      await this.boards.clear();
      await this.canvasItems.clear();
      await this.imageData.clear();
      await this.appSettings.clear();
    });
  }

  /**
   * Get database info for debugging
   */
  async getDatabaseInfo(): Promise<{
    version: number;
    name: string;
    tables: {
      folders: number;
      boards: number;
      canvasItems: number;
      imageData: number;
      appSettings: number;
    };
  }> {
    const tables = {
      folders: await this.folders.count(),
      boards: await this.boards.count(),
      canvasItems: await this.canvasItems.count(),
      imageData: await this.imageData.count(),
      appSettings: await this.appSettings.count(),
    };

    return {
      version: this.verno,
      name: this.name,
      tables,
    };
  }
}

// Export a singleton instance
export const db = new MeroDatabase();