import { ItemType, ShapeType, PanZoom, BoardItem } from '../../../types';

// Folder/Workspace entity
export interface FolderEntity {
  id?: number; // Primary key (auto-incremented by IndexedDB)
  folderId: string; // UUID for folder
  name: string;
  parentId?: string; // For nested folders (null = root level)
  createdAt: number;
  updatedAt: number;
  isExpanded?: boolean; // UI state
}

// Board entity (canvases)
export interface BoardEntity {
  id?: number; // Primary key
  boardId: string; // UUID for board
  folderId?: string; // Which folder contains this board
  name: string;
  description?: string;
  thumbnail?: string; // Base64 thumbnail for quick preview
  createdAt: number;
  updatedAt: number;
  lastAccessedAt: number;
  // Board metadata
  maxZIndex: number;
  backgroundColor?: string;
  dotDensity?: number;
  toolbarPosition?: 'top' | 'left' | 'bottom' | 'right';
  panZoom: PanZoom; // Current view state
}

// Canvas items (now board-specific)
export interface CanvasItemEntity {
  id?: number; // Primary key
  itemId: string; // Your existing UUID
  boardId: string; // Which board this item belongs to
  type: ItemType;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  backgroundColor: string;
  zIndex: number;
  shape?: ShapeType;
  textColor?: string;
  fontSize?: number;
  fontFamily?: string;
  originalFontSize?: number;
  originalWidth?: number;
  originalHeight?: number;
  rotation?: number;
  votes: number;
  videoId?: string;
  isMaximized?: boolean;
  // AI-related fields
  isAiEditing?: boolean;
  aiEditPrompt?: string;
  aiEditHistory?: Array<{
    prompt: string;
    resultUrl: string;
    timestamp: number;
    requestId?: string;
  }>;
  videoPrompt?: string;
  // Obsidian data
  obsidianData?: {
    filePath: string;
    fileName: string;
    markdownContent: string;
    lastModified: number;
    tags?: string[];
    links?: string[];
    backlinks?: string[];
    wordCount?: number;
  };
  scaleThresholds?: {
    preview: number;
    content: number;
    detailed: number;
  };
  noteData?: BoardItem['noteData'];
  // Reference to image data
  imageDataId?: number;
  crop?: { x: number; y: number; width: number; height: number };
  children?: string[]; // For frames
  createdAt: number;
  updatedAt: number;
}

// Image data (cross-board referenceable)
export interface ImageDataEntity {
  id?: number; // Primary key
  imageId: string; // UUID for image
  itemId: string; // Which item uses this image
  boardId: string; // Which board this image belongs to
  type: 'src' | 'generatedImageUrl' | 'generatedVideoUrl';
  data: Blob; // The actual image/video data
  fileName?: string;
  mimeType?: string;
  size: number;
  createdAt: number;
}

// User preferences and app settings
export interface AppSettingsEntity {
  id?: number; // Primary key (always 1 for singleton)
  currentBoardId?: string;
  sidebarWidth: number;
  theme: 'dark' | 'light';
  autoSave: boolean;
  autoSaveInterval: number; // in seconds
  recentlyUsedBoards: string[]; // Array of board IDs
  updatedAt: number;
}

// Database configuration
export const DATABASE_VERSION = 2; // Updated for new schema
export const DATABASE_NAME = 'MeroCanvasDB';

// Migration types
export interface LocalStorageData {
  items: BoardItem[];
  panZoom: PanZoom;
}

export interface MigrationResult {
  success: boolean;
  message: string;
  migratedItems: number;
  migratedImages: number;
}