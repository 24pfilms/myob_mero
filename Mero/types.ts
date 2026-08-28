export enum ItemType {
  StickyNote = 'STICKY_NOTE',
  Shape = 'SHAPE',
  TextBox = 'TEXT_BOX',
  Frame = 'FRAME',
  Image = 'IMAGE',
  YouTubeVideo = 'YOUTUBE_VIDEO',
  ObsidianNote = 'OBSIDIAN_NOTE',
  NoteCard = 'NOTE_CARD',
}

export enum ShapeType {
  Rectangle = 'RECTANGLE',
  Circle = 'CIRCLE',
  Triangle = 'TRIANGLE',
  RoundedRectangle = 'ROUNDED_RECTANGLE',
  Diamond = 'DIAMOND',
  Hexagon = 'HEXAGON',
  Line = 'LINE',
  ArrowUp = 'ARROW_UP',
  ArrowRight = 'ARROW_RIGHT',
  ArrowDown = 'ARROW_DOWN',
  ArrowLeft = 'ARROW_LEFT',
  ArrowBoth = 'ARROW_BOTH',
}

export type ConnectionPoint = 'top' | 'right' | 'bottom' | 'left';

export interface NoteCardData {
  noteId: string;
  title: string;
  tags: string[];
  excerpt: string;
  updatedAt: string | null;
  embeddingState: 'missing' | 'pending' | 'ready' | 'failed' | 'legacy';
  syncState?: 'loading' | 'ready' | 'stale' | 'missing' | 'error';
}

export interface BoardItem {
  id: string;
  type: ItemType;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  backgroundColor: string;
  zIndex: number;
  shape?: ShapeType;
  votes: number;
  // For frames
  children?: string[];
  // For images
  src?: string;
  textColor?: string;
  fontSize?: number;
  fontFamily?: string;
  originalFontSize?: number;
  // For generated content in shapes
  generatedImageUrl?: string;
  generatedVideoUrl?: string;
  rotation?: number;
  // For image cropping
  crop?: { x: number; y: number; width: number; height: number };
  originalWidth?: number;
  originalHeight?: number;
  // For YouTube videos
  videoId?: string;
  // For Obsidian notes
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
  // Durable MyOb note reference; full note content stays in MyOb.
  noteData?: NoteCardData;
  // For AI image editing with Nano Banana
  isAiEditing?: boolean;
  aiEditPrompt?: string;
  originalImageUrl?: string; // Store original before AI editing
  aiEditHistory?: {
    prompt: string;
    resultUrl: string;
    timestamp: number;
    requestId?: string;
  }[];
  // For generated videos from images
  videoPrompt?: string;
  // For image display states
  isMaximized?: boolean;
  originalSize?: { width: number; height: number };
  originalPosition?: { x: number; y: number };
  // Scale-dependent rendering
  scaleThresholds?: {
    preview: number;    // Below this scale, show preview/summary
    content: number;    // Above this scale, show full content
    detailed: number;   // Above this scale, show markdown rendering
  };
  // Per-item drawing layer (pen tool annotations)
  drawingData?: string; // Base64 PNG of the drawing overlay
}

// Drawing tool types
export type DrawingTool = 'pen' | 'eraser' | null;

export interface PanZoom {
  x: number;
  y: number;
  k: number;
}

export interface ContextMenuData {
  x: number;
  y: number;
  itemIds: string[];
}