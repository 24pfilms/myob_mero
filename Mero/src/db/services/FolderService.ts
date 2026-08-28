import { db } from '../Database';
import { FolderEntity } from '../types/database';
import { MeroDatabase } from '../Database';

export interface CreateFolderOptions {
  name: string;
  parentId?: string;
}

export interface UpdateFolderOptions {
  name?: string;
  parentId?: string;
  isExpanded?: boolean;
}

/**
 * Service for folder operations
 */
export class FolderService {
  /**
   * Create a new folder
   */
  static async createFolder(options: CreateFolderOptions): Promise<FolderEntity> {
    const now = Date.now();
    const folderId = MeroDatabase.generateId();
    
    const folder: FolderEntity = {
      folderId,
      name: options.name,
      parentId: options.parentId,
      isExpanded: true,
      createdAt: now,
      updatedAt: now,
    };

    await db.folders.add(folder);
    return folder;
  }

  /**
   * Get all folders
   */
  static async getAllFolders(): Promise<FolderEntity[]> {
    return await db.folders.orderBy('name').toArray();
  }

  /**
   * Get folder by ID
   */
  static async getFolder(folderId: string): Promise<FolderEntity | undefined> {
    return await db.folders.where('folderId').equals(folderId).first();
  }

  /**
   * Get root folders (no parent)
   */
  static async getRootFolders(): Promise<FolderEntity[]> {
    return await db.folders.where('parentId').equals(undefined).toArray();
  }

  /**
   * Get child folders of a parent
   */
  static async getChildFolders(parentId?: string): Promise<FolderEntity[]> {
    if (parentId === undefined) {
      return this.getRootFolders();
    }
    return await db.folders.where('parentId').equals(parentId).toArray();
  }

  /**
   * Get folder hierarchy (recursive)
   */
  static async getFolderHierarchy(rootFolderId?: string): Promise<FolderEntity[]> {
    const rootFolders = rootFolderId 
      ? [await this.getFolder(rootFolderId)].filter(Boolean) as FolderEntity[]
      : await this.getRootFolders();

    const buildHierarchy = async (folders: FolderEntity[]): Promise<FolderEntity[]> => {
      for (const folder of folders) {
        const children = await this.getChildFolders(folder.folderId);
        if (children.length > 0) {
          (folder as any).children = await buildHierarchy(children);
        }
      }
      return folders;
    };

    return await buildHierarchy(rootFolders);
  }

  /**
   * Update a folder
   */
  static async updateFolder(folderId: string, updates: UpdateFolderOptions): Promise<boolean> {
    const folder = await this.getFolder(folderId);
    if (!folder) return false;

    // Prevent circular references
    if (updates.parentId !== undefined && updates.parentId !== folder.parentId) {
      if (await this.wouldCreateCircularReference(folderId, updates.parentId)) {
        throw new Error('Cannot move folder: would create circular reference');
      }
    }

    await db.folders.where('folderId').equals(folderId).modify((folder) => {
      Object.assign(folder, updates, { updatedAt: Date.now() });
    });

    return true;
  }

  /**
   * Delete a folder and its contents
   */
  static async deleteFolder(folderId: string, deleteContents: boolean = false): Promise<boolean> {
    const folder = await this.getFolder(folderId);
    if (!folder) return false;

    // Check if folder has contents
    const childFolders = await this.getChildFolders(folderId);
    const boards = await db.boards.where('folderId').equals(folderId).toArray();
    
    if (!deleteContents && (childFolders.length > 0 || boards.length > 0)) {
      throw new Error('Cannot delete non-empty folder. Use deleteContents=true to delete with contents.');
    }

    await db.transaction('rw', db.folders, db.boards, db.canvasItems, db.imageData, async () => {
      // Recursively delete child folders
      for (const childFolder of childFolders) {
        await this.deleteFolder(childFolder.folderId, true);
      }

      // Delete all boards in this folder
      for (const board of boards) {
        const items = await db.canvasItems.where('boardId').equals(board.boardId).toArray();
        const itemIds = items.map(item => item.itemId);
        
        // Delete image data
        await db.imageData.where('itemId').anyOf(itemIds).delete();
        
        // Delete items
        await db.canvasItems.where('boardId').equals(board.boardId).delete();
        
        // Delete board
        await db.boards.where('boardId').equals(board.boardId).delete();
      }

      // Delete the folder
      await db.folders.where('folderId').equals(folderId).delete();
    });

    return true;
  }

  /**
   * Move folder to another parent
   */
  static async moveFolder(folderId: string, targetParentId?: string): Promise<boolean> {
    return await this.updateFolder(folderId, { parentId: targetParentId });
  }

  /**
   * Check if creating a parent-child relationship would cause a circular reference
   */
  private static async wouldCreateCircularReference(folderId: string, newParentId?: string): Promise<boolean> {
    if (!newParentId) return false;

    let currentParentId: string | undefined = newParentId;
    while (currentParentId) {
      if (currentParentId === folderId) {
        return true; // Circular reference detected
      }
      const parent = await this.getFolder(currentParentId);
      currentParentId = parent?.parentId;
    }
    
    return false;
  }

  /**
   * Search folders by name
   */
  static async searchFolders(query: string): Promise<FolderEntity[]> {
    if (!query.trim()) return this.getAllFolders();
    
    const lowerQuery = query.toLowerCase();
    return await db.folders
      .toCollection()
      .filter(folder => folder.name.toLowerCase().includes(lowerQuery))
      .toArray();
  }

  /**
   * Get folder path (breadcrumb)
   */
  static async getFolderPath(folderId?: string): Promise<FolderEntity[]> {
    if (!folderId) return [];
    
    const path: FolderEntity[] = [];
    let currentFolder: FolderEntity | undefined = await this.getFolder(folderId);
    
    while (currentFolder) {
      path.unshift(currentFolder);
      if (currentFolder.parentId) {
        currentFolder = await this.getFolder(currentFolder.parentId);
      } else {
        currentFolder = undefined;
      }
    }
    
    return path;
  }

  /**
   * Get folder statistics
   */
  static async getFolderStats(folderId: string): Promise<{
    boardCount: number;
    itemCount: number;
    totalSize: number;
    childFolders: number;
  }> {
    const childFolders = await this.getChildFolders(folderId);
    const boards = await db.boards.where('folderId').equals(folderId).toArray();
    
    let totalItemCount = 0;
    let totalSize = 0;
    
    for (const board of boards) {
      const items = await db.canvasItems.where('boardId').equals(board.boardId).toArray();
      const itemIds = items.map(item => item.itemId);
      const imageData = await db.imageData.where('itemId').anyOf(itemIds).toArray();
      
      totalItemCount += items.length;
      totalSize += imageData.reduce((sum, img) => sum + img.size, 0);
    }
    
    return {
      boardCount: boards.length,
      itemCount: totalItemCount,
      totalSize,
      childFolders: childFolders.length
    };
  }

  /**
   * Expand/collapse folder
   */
  static async toggleFolderExpanded(folderId: string): Promise<boolean> {
    const folder = await this.getFolder(folderId);
    if (!folder) return false;
    
    return await this.updateFolder(folderId, { isExpanded: !folder.isExpanded });
  }

  /**
   * Get all folders in tree structure
   */
  static async getFolderTree(): Promise<(FolderEntity & { children: any[] })[]> {
    const rootFolders = await this.getRootFolders();
    
    const buildTree = async (folders: FolderEntity[]): Promise<(FolderEntity & { children: any[] })[]> => {
      const tree: (FolderEntity & { children: any[] })[] = [];
      
      for (const folder of folders) {
        const children = await this.getChildFolders(folder.folderId);
        const childTree = children.length > 0 ? await buildTree(children) : [];
        
        tree.push({
          ...folder,
          children: childTree
        });
      }
      
      return tree;
    };
    
    return await buildTree(rootFolders);
  }
}