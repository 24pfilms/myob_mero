import React, { useState, useCallback, useRef, useEffect } from 'react';
import { BoardItem, ItemType, ShapeType, ContextMenuData, PanZoom } from '../types';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useUndoRedo } from './useUndoRedo';
import { BoardService } from '../src/db/services/BoardService';
import { ItemService } from '../src/db/services/ItemService';
import { db } from '../src/db/Database';
import { api } from '../services/api';

// Configure the PDF.js worker source. This is required for PDF parsing to work.
// The worker is fetched from a CDN to avoid needing to host it locally.
if (typeof window !== 'undefined' && 'Worker' in window) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

const STORAGE_KEY = 'infinite-canvas-board';
const CURRENT_BOARD_STORAGE_KEY = 'mero-current-board-id';
const DEFAULT_CANVAS_BG = '#111827';
const DEFAULT_DOT_DENSITY = 20;

// Coordinate transformation utilities
const screenToCanvasCoordinates = (
    screenX: number,
    screenY: number,
    canvasElement: HTMLElement,
    panZoom: PanZoom
): { x: number; y: number } => {
    const rect = canvasElement.getBoundingClientRect();
    // Convert screen coordinates to canvas world coordinates
    // Account for the CSS transform: translate(panZoom.x, panZoom.y) scale(panZoom.k)
    const relativeX = screenX - rect.left;  // Position relative to canvas element
    const relativeY = screenY - rect.top;   // Position relative to canvas element
    
    // Reverse the transform: (screen_pos - translation) / scale
    const canvasX = (relativeX - panZoom.x) / panZoom.k;
    const canvasY = (relativeY - panZoom.y) / panZoom.k;
    return { x: canvasX, y: canvasY };
};

const canvasToScreenCoordinates = (
    canvasX: number,
    canvasY: number,
    canvasElement: HTMLElement,
    panZoom: PanZoom
): { x: number; y: number } => {
    const rect = canvasElement.getBoundingClientRect();
    // Convert canvas coordinates to screen coordinates
    const screenX = canvasX * panZoom.k + panZoom.x + rect.left;
    const screenY = canvasY * panZoom.k + panZoom.y + rect.top;
    return { x: screenX, y: screenY };
};

// Helper function to determine the best contrasting text color (black or white) for a given background hex color.
const getContrastingTextColor = (hex: string): string => {
  if (!hex || hex === 'transparent') return '#FFFFFF'; // Default to white for transparent or missing bg
  
  // Sanitize hex string
  const sanitizedHex = hex.startsWith('#') ? hex.slice(1) : hex;
  if (sanitizedHex.length !== 6) return '#FFFFFF'; // Invalid hex
  
  const r = parseInt(sanitizedHex.slice(0, 2), 16);
  const g = parseInt(sanitizedHex.slice(2, 4), 16);
  const b = parseInt(sanitizedHex.slice(4, 6), 16);
  
  // Using the luminance formula to determine brightness
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  return luminance > 0.5 ? '#000000' : '#FFFFFF'; // Black for light bg, white for dark bg
};

const loadState = async (): Promise<{ items: BoardItem[]; panZoom: PanZoom; boardId: string | null; backgroundColor: string; dotDensity: number }> => {
    try {
        // Wait for database to be open with retry logic
        let dbRetries = 0;
        const maxDbRetries = 10;
        while (!db.isOpen() && dbRetries < maxDbRetries) {
            console.log(`⏳ Waiting for database to open... (attempt ${dbRetries + 1}/${maxDbRetries})`);
            try {
                await db.open();
                console.log('✅ Database opened');
                break;
            } catch (error) {
                console.warn('Database open attempt failed:', error);
                await new Promise(resolve => setTimeout(resolve, 200));
                dbRetries++;
            }
        }
        
        if (!db.isOpen()) {
            throw new Error('Database failed to open after multiple attempts');
        }
        
        // Additional check: ensure settings table is initialized
        let settingsRetries = 0;
        const maxSettingsRetries = 5;
        let settings = null;
        
        while (!settings && settingsRetries < maxSettingsRetries) {
            try {
                settings = await db.appSettings.get(1);
                if (settings) break;
                
                // Settings don't exist yet, might still be initializing
                console.log(`⏳ Waiting for app settings to initialize... (attempt ${settingsRetries + 1}/${maxSettingsRetries})`);
                await new Promise(resolve => setTimeout(resolve, 300));
                settingsRetries++;
            } catch (error) {
                console.warn('Settings fetch attempt failed:', error);
                await new Promise(resolve => setTimeout(resolve, 300));
                settingsRetries++;
            }
        }
        
        // If settings still don't exist after retries, create them
        if (!settings) {
            console.log('✨ Creating default app settings...');
            await db.initializeDefaultSettings();
            settings = await db.appSettings.get(1);
            console.log('✅ Default settings created');
        }
        
        // Try to load from IndexedDB first (settings already loaded above)
        if (settings?.currentBoardId) {
            const board = await BoardService.getBoard(settings.currentBoardId);
            if (board) {
                const items = await ItemService.getBoardItems(board.boardId);
                if (items && items.length > 0) {
                    maxZIndex.current = Math.max(...items.map(i => i.zIndex));
                }
                console.log(`✅ Loaded board "${board.name}" with ${items.length} items from IndexedDB`);
                return { items, panZoom: board.panZoom, boardId: board.boardId, backgroundColor: board.backgroundColor || DEFAULT_CANVAS_BG, dotDensity: board.dotDensity ?? DEFAULT_DOT_DENSITY };
            }
        }
        
        // No current board - check if any boards exist
        console.log('🔍 No current board set, checking for existing boards...');
        const allBoards = await BoardService.getAllBoards();
        
        if (allBoards.length > 0) {
            // Use the first board
            const board = allBoards[0];
            console.log(`📌 Using existing board: "${board.name}"`);
            
            // Set it as current
            if (settings) {
                await db.appSettings.update(1, { currentBoardId: board.boardId });
            }
            
            const items = await ItemService.getBoardItems(board.boardId);
            if (items && items.length > 0) {
                maxZIndex.current = Math.max(...items.map(i => i.zIndex));
            }
            console.log(`✅ Loaded board "${board.name}" with ${items.length} items from IndexedDB`);
            return { items, panZoom: board.panZoom, boardId: board.boardId, backgroundColor: board.backgroundColor || DEFAULT_CANVAS_BG, dotDensity: board.dotDensity ?? DEFAULT_DOT_DENSITY };
        }
        
        // No boards exist - create a default one
        console.log('✨ No boards exist, creating default board...');
        
        // Double-check no boards were created in the meantime
        const doubleCheck = await BoardService.getAllBoards();
        if (doubleCheck.length > 0) {
            console.log('🔄 Board appeared during check, using it instead');
            const board = doubleCheck[0];
            if (settings) {
                await db.appSettings.update(1, { currentBoardId: board.boardId });
            }
            const items = await ItemService.getBoardItems(board.boardId);
            return { items, panZoom: board.panZoom, boardId: board.boardId, backgroundColor: board.backgroundColor || DEFAULT_CANVAS_BG, dotDensity: board.dotDensity ?? DEFAULT_DOT_DENSITY };
        }
        
        const newBoard = await BoardService.createBoard({
            name: 'My First Board',
            description: 'Your default canvas',
        });
        
        // Set it as current
        if (settings) {
            await db.appSettings.update(1, { currentBoardId: newBoard.boardId });
        }
        
        console.log(`✅ Created and loaded board "${newBoard.name}"`);
        return { items: [], panZoom: newBoard.panZoom, boardId: newBoard.boardId, backgroundColor: newBoard.backgroundColor || DEFAULT_CANVAS_BG, dotDensity: newBoard.dotDensity ?? DEFAULT_DOT_DENSITY };
        
    } catch (error) {
        console.log('⚠️ IndexedDB error, will try localStorage:', error);
    }
    
    // Fallback to localStorage (legacy support) - but migrate it to a board!
    try {
        const savedState = localStorage.getItem(STORAGE_KEY);
        if (savedState) {
            const { items, panZoom } = JSON.parse(savedState);
            console.log(`📦 Found ${items?.length || 0} items in localStorage (legacy)`);
            
            // Try to migrate this data to a proper board in IndexedDB
            try {
                if (db.isOpen()) {
                    console.log('✨ Migrating localStorage data to IndexedDB...');
                    
                    // Create a board for this legacy data
                    const newBoard = await BoardService.createBoard({
                        name: 'Migrated Board',
                        description: 'Imported from localStorage',
                    });
                    
                    // Set panzoom from legacy data
                    if (panZoom) {
                        await BoardService.updateBoard(newBoard.boardId, { panZoom });
                    }
                    
                    // Create items in the new board
                    if (items && items.length > 0) {
                        for (const item of items) {
                            await ItemService.createItem(newBoard.boardId, item);
                        }
                        maxZIndex.current = Math.max(...items.map(i => i.zIndex));
                    }
                    
                    // Update settings to use this board
                    let settings = await db.appSettings.get(1);
                    if (!settings) {
                        await db.initializeDefaultSettings();
                        settings = await db.appSettings.get(1);
                    }
                    if (settings) {
                        await db.appSettings.update(1, { currentBoardId: newBoard.boardId });
                    }
                    
                    console.log(`✅ Successfully migrated to board "${newBoard.name}"`);
                    return { items: items || [], panZoom: panZoom || { x: 0, y: 0, k: 1 }, boardId: newBoard.boardId, backgroundColor: DEFAULT_CANVAS_BG, dotDensity: DEFAULT_DOT_DENSITY };
                }
            } catch (migrationError) {
                console.error('⚠️ Failed to migrate localStorage data:', migrationError);
                // Continue with legacy load if migration fails
            }
            
            // If migration failed, return legacy data (will still work but won't persist)
            if (items && items.length > 0) {
                maxZIndex.current = Math.max(...items.map(i => i.zIndex));
            }
            console.log('⚠️ Using localStorage data without database (won\'t persist)');
            return { items: items || [], panZoom: panZoom || { x: 0, y: 0, k: 1 }, boardId: null, backgroundColor: DEFAULT_CANVAS_BG, dotDensity: DEFAULT_DOT_DENSITY };
        }
    } catch (error) {
        console.error("Failed to load state from localStorage", error);
    }
    
    return { items: [], panZoom: { x: 0, y: 0, k: 1 }, boardId: null, backgroundColor: DEFAULT_CANVAS_BG, dotDensity: DEFAULT_DOT_DENSITY };
};

const maxZIndex = { current: 0 };

type LoadedBoardState = {
    items: BoardItem[];
    panZoom: PanZoom;
    boardId: string | null;
    backgroundColor: string;
    dotDensity: number;
};

const mapApiItemToBoardItem = (apiItem: {
    item_id: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    z_index: number;
    rotation: number;
    data: Record<string, any>;
}): BoardItem => {
    const data = apiItem.data || {};
    const merged: any = { ...data };

    merged.id = apiItem.item_id;
    merged.type = apiItem.type as ItemType;
    merged.x = apiItem.x;
    merged.y = apiItem.y;
    merged.width = apiItem.width;
    merged.height = apiItem.height;
    merged.zIndex = apiItem.z_index ?? merged.zIndex ?? 0;
    merged.rotation = apiItem.rotation ?? merged.rotation ?? 0;

    if (merged.text === undefined || merged.text === null) merged.text = '';
    if (merged.backgroundColor === undefined || merged.backgroundColor === null) merged.backgroundColor = '#fff38a';
    if (merged.votes === undefined || merged.votes === null) merged.votes = 0;
    if (merged.shape === undefined && merged.type === ItemType.Shape) merged.shape = ShapeType.Rectangle;
    if (merged.textColor === undefined) merged.textColor = merged.type === ItemType.TextBox ? '#FFFFFF' : '#000000';
    if (merged.fontFamily === undefined) merged.fontFamily = 'Inter, sans-serif';
    if (merged.fontSize === undefined) merged.fontSize = merged.type === ItemType.TextBox ? 24 : 16;

    return merged as BoardItem;
};

const mapBoardItemToApiItem = (item: BoardItem) => {
    const { id, type, x, y, width, height, zIndex, rotation, ...data } = item;
    return {
        item_id: id,
        type,
        x,
        y,
        width,
        height,
        z_index: zIndex,
        rotation: rotation ?? 0,
        data,
    };
};

const loadApiState = async (preferredBoardId?: string | null): Promise<LoadedBoardState> => {
    // Pick board
    const stored = localStorage.getItem(CURRENT_BOARD_STORAGE_KEY);
    let boardId = preferredBoardId || stored;

    if (!boardId) {
        const list = await api.getBoards();
        if (list.boards.length === 0) {
            const created = await api.createBoard('My First Board', 'Your default canvas');
            boardId = created.board_id;
        } else {
            boardId = list.boards[0].board_id;
        }
    }

    let payload;
    try {
        payload = await api.getBoard(boardId);
    } catch (err) {
        // Stored board id might be stale.
        localStorage.removeItem(CURRENT_BOARD_STORAGE_KEY);

        const list = await api.getBoards();
        if (list.boards.length === 0) {
            const created = await api.createBoard('My First Board', 'Your default canvas');
            boardId = created.board_id;
        } else {
            boardId = list.boards[0].board_id;
        }
        payload = await api.getBoard(boardId);
    }
    localStorage.setItem(CURRENT_BOARD_STORAGE_KEY, boardId);

    const panZoom: PanZoom = {
        x: payload.settings.pan_x ?? 0,
        y: payload.settings.pan_y ?? 0,
        k: payload.settings.zoom ?? 1,
    };

    const backgroundColor = payload.settings.background_color || DEFAULT_CANVAS_BG;
    const dotDensity = payload.settings.dot_density ?? DEFAULT_DOT_DENSITY;

    const items = (payload.items || []).map(mapApiItemToBoardItem);
    if (items.length > 0) {
        maxZIndex.current = Math.max(...items.map(i => i.zIndex));
    } else {
        maxZIndex.current = 0;
    }

    return { items, panZoom, boardId, backgroundColor, dotDensity };
};

const loadLocalBoardState = async (boardId: string): Promise<LoadedBoardState> => {
    const board = await BoardService.getBoard(boardId);
    if (!board) throw new Error('Board not found');

    const loadedItems = await ItemService.getBoardItems(boardId);
    if (loadedItems.length > 0) {
        maxZIndex.current = Math.max(...loadedItems.map(i => i.zIndex));
    } else {
        maxZIndex.current = 0;
    }

    await BoardService.updateRecentlyUsed(boardId);
    return {
        items: loadedItems,
        panZoom: board.panZoom,
        boardId: board.boardId,
        backgroundColor: board.backgroundColor || DEFAULT_CANVAS_BG,
        dotDensity: board.dotDensity ?? DEFAULT_DOT_DENSITY,
    };
};

interface SelectionBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

// Helper to find items that are inside a frame's bounds
const getItemsInsideFrame = (frame: BoardItem, allItems: BoardItem[]): BoardItem[] => {
    if (frame.type !== ItemType.Frame) return [];
    
    return allItems.filter(item => {
        if (item.id === frame.id) return false; // Don't include the frame itself
        
        // Check if item's center is inside the frame
        const itemCenterX = item.x + item.width / 2;
        const itemCenterY = item.y + item.height / 2;
        
        return (
            itemCenterX >= frame.x &&
            itemCenterX <= frame.x + frame.width &&
            itemCenterY >= frame.y &&
            itemCenterY <= frame.y + frame.height
        );
    });
};

export const useBoard = (options?: { authToken?: string | null }) => {
    const authToken = options?.authToken ?? api.getToken();
    const [initialState, setInitialState] = useState<LoadedBoardState>({
        items: [],
        panZoom: { x: 0, y: 0, k: 1 },
        boardId: null,
        backgroundColor: DEFAULT_CANVAS_BG,
        dotDensity: DEFAULT_DOT_DENSITY,
    });
    const [currentBoardId, setCurrentBoardId] = useState<string | null>(null);
    const [isLoadingBoard, setIsLoadingBoard] = useState(true);
    const [itemsInitialized, setItemsInitialized] = useState(false);
    
    // Load initial state from database
    useEffect(() => {
        const loadInitialState = async () => {
            console.log('🔄 Loading initial board state...');
            setIsLoadingBoard(true);
            setItemsInitialized(false);
            hasLoadedFromServerRef.current = false;
            
            try {
                const state = authToken ? await loadApiState() : await loadState();

                if (state.boardId) {
                    localStorage.setItem(CURRENT_BOARD_STORAGE_KEY, state.boardId);
                }
                
                console.log('📦 Loaded state:', {
                    boardId: state.boardId,
                    itemCount: state.items.length,
                    panZoom: state.panZoom
                });
                
                setInitialState(state);
                setCurrentBoardId(state.boardId);
                setIsLoadingBoard(false);
                console.log('✅ Board loading complete');
            } catch (error) {
                console.error('❌ Fatal error loading board state:', error);
                // Set empty state as fallback
                const fallbackState: LoadedBoardState = { items: [], panZoom: { x: 0, y: 0, k: 1 }, boardId: null, backgroundColor: DEFAULT_CANVAS_BG, dotDensity: DEFAULT_DOT_DENSITY };
                setInitialState(fallbackState);
                setCurrentBoardId(null);
                setIsLoadingBoard(false);
            }
        };
        loadInitialState();
    }, [authToken]);
    
    // Initialize undo/redo system for items
    const {
        currentState: undoItems,
        pushToHistory,
        resetHistory,
        undo,
        redo,
        canUndo,
        canRedo
    } = useUndoRedo<BoardItem[]>(initialState.items);
    
    // Separate state for immediate visual updates during drag
    const [items, setItems] = useState<BoardItem[]>(undoItems);
    const itemsRef = useRef<BoardItem[]>(undoItems);

    useEffect(() => {
        itemsRef.current = items;
    }, [items]);
    
    const lastHistoryBoardIdRef = useRef<string | null>(null);
    const hasLoadedFromServerRef = useRef(false);

    // When a board finishes loading, reset undo/redo history to match loaded items.
    useEffect(() => {
        if (isLoadingBoard) return;
        if (lastHistoryBoardIdRef.current === currentBoardId && itemsInitialized) return;

        console.log('📥 Resetting history with', initialState.items.length, 'items from server');
        resetHistory(initialState.items);
        lastHistoryBoardIdRef.current = currentBoardId;
        hasLoadedFromServerRef.current = true;
        setItemsInitialized(true);
    }, [isLoadingBoard, currentBoardId, initialState.items, resetHistory, itemsInitialized]);
    
    // Center content when board finishes loading
    const lastCenteredBoardIdRef = useRef<string | null>(null);
    
    useEffect(() => {
        // Only center once per board load
        if (isLoadingBoard || !itemsInitialized) return;
        if (lastCenteredBoardIdRef.current === currentBoardId) return;
        
        // Mark this board as centered
        lastCenteredBoardIdRef.current = currentBoardId;
        
        // Delay to ensure canvas is fully rendered and items state is updated
        const timerId = setTimeout(() => {
            // Use ref to get latest items state
            const currentItems = itemsRef.current;
            if (currentItems.length > 0) {
                console.log('🎯 Auto-centering content for board:', currentBoardId, 'with', currentItems.length, 'items');
                centerContentBelowToolbar();
            } else {
                // No items - reset to default view
                console.log('🎯 No items, resetting to default view');
                setPanZoom({ x: 0, y: 0, k: 1 });
            }
        }, 250);
        
        return () => clearTimeout(timerId);
    }, [isLoadingBoard, itemsInitialized, currentBoardId]);
    
    // Sync visual state with undo/redo state
    useEffect(() => {
        setItems(undoItems);
    }, [undoItems]);
    
    const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
    const [panZoom, setPanZoom] = useState<PanZoom>(initialState.panZoom);
    const [backgroundColor, setBackgroundColor] = useState<string>(initialState.backgroundColor);
    const [dotDensity, setDotDensity] = useState<number>(initialState.dotDensity);
    const [isPanning, setIsPanning] = useState(false);
    const [isZooming, setIsZooming] = useState(false);
    const zoomTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    // Smooth zoom interpolation refs
    const targetZoomRef = useRef<{ k: number; x: number; y: number } | null>(null);
    const zoomAnimationRef = useRef<number | null>(null);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });
    const [contextMenu, setContextMenu] = useState<ContextMenuData | null>(null);
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [interactiveItemId, setInteractiveItemId] = useState<string | null>(null);
    const [generatingItems, setGeneratingItems] = useState<Set<string>>(new Set());
    const [generationModal, setGenerationModal] = useState<{itemId: string | null}>({ itemId: null });
    const [croppingItemId, setCroppingItemId] = useState<string | null>(null);
    const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
    
    const dragInfo = useRef<{ 
        startX: number; 
        startY: number; 
        itemStartPositions: Map<string, {x: number, y: number}>; 
        isDragging: boolean; 
        hasDragged: boolean;
        isResizing: boolean;
        resizeHandle: string | null;
        itemStartForResize: BoardItem | null;
        resizeStartDimensions: { width: number; height: number; aspectRatio: number } | null;
        isRotating: boolean;
        itemStartForRotation: BoardItem | null;
        rotationStartAngle: number;
        isCopyOperation: boolean;
        copiedItemIds: Set<string>;
        frameChildrenIds: Set<string>; // IDs of items inside frames being dragged
     }>({
        startX: 0,
        startY: 0,
        itemStartPositions: new Map(),
        isDragging: false,
        hasDragged: false,
        isResizing: false,
        resizeHandle: null,
        itemStartForResize: null,
        resizeStartDimensions: null,
        isRotating: false,
        itemStartForRotation: null,
        rotationStartAngle: 0,
        isCopyOperation: false,
        copiedItemIds: new Set(),
        frameChildrenIds: new Set(),
    });
    
    const canvasRef = useRef<HTMLDivElement>(null);
    const itemsContainerRef = useRef<HTMLDivElement>(null);
    const rightSelection = useRef({
        active: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        didMove: false,
    });
    const suppressContextMenuRef = useRef(false);

    // Apply loaded board settings to local state after load/switch.
    // Note: We don't restore panZoom here - we let the auto-center logic handle positioning
    useEffect(() => {
        if (isLoadingBoard) return;
        setBackgroundColor(initialState.backgroundColor);
        setDotDensity(initialState.dotDensity);
    }, [isLoadingBoard, initialState.backgroundColor, initialState.dotDensity]);

    // Auto-save board settings (pan/zoom + canvas appearance)
    useEffect(() => {
        if (isLoadingBoard) return; // Don't save while still loading

        if (!currentBoardId) return;

        const saveState = async () => {
            try {
                if (authToken) {
                    await api.updateBoardSettings(currentBoardId, {
                        pan_x: panZoom.x,
                        pan_y: panZoom.y,
                        zoom: panZoom.k,
                        background_color: backgroundColor,
                        dot_density: dotDensity,
                    });
                } else {
                    await BoardService.updateBoard(currentBoardId, { panZoom, backgroundColor, dotDensity });
                }
            } catch (error) {
                console.error("Failed to save board settings:", error);
            }
        };
        
        // Debounce the save
        const timeoutId = setTimeout(saveState, 500);
        return () => clearTimeout(timeoutId);
    }, [panZoom, backgroundColor, dotDensity, currentBoardId, isLoadingBoard, authToken]);

    // Sync items to storage (API or IndexedDB)
    useEffect(() => {
        if (!currentBoardId || isLoadingBoard || !itemsInitialized) {
            console.log('⏸️ Skipping sync - boardId:', currentBoardId, 'loading:', isLoadingBoard, 'initialized:', itemsInitialized);
            return;
        }
        
        // Don't sync until we've loaded from server at least once (prevents wiping data on init)
        if (!hasLoadedFromServerRef.current) {
            console.log('⏸️ Skipping sync - haven\'t loaded from server yet');
            return;
        }
        
        // Prevent syncing empty items if we expect items to exist (race condition guard)
        if (items.length === 0 && initialState.items.length > 0) {
            console.log('⏸️ Skipping sync - items empty but initialState has items (likely race condition)');
            return;
        }
        
        const syncItems = async () => {
            try {
                if (authToken) {
                    console.log(`💾 Syncing ${items.length} items to API for board: ${currentBoardId}`);
                    await api.syncItems(currentBoardId, items.map(mapBoardItemToApiItem));
                    console.log('✅ Items synced to API');
                } else {
                    console.log(`💾 Syncing ${items.length} items to database for board: ${currentBoardId}`);
                    
                    // Get existing items from database to compare
                    const dbItems = await ItemService.getBoardItems(currentBoardId);
                    console.log(`📊 Database currently has ${dbItems.length} items`);
                    
                    const dbItemIds = new Set(dbItems.map(item => item.id));
                    const currentItemIds = new Set(items.map(item => item.id));
                    
                    // Find items to delete (in DB but not in current state)
                    const itemsToDelete = dbItems.filter(dbItem => !currentItemIds.has(dbItem.id));
                    for (const item of itemsToDelete) {
                        await ItemService.deleteItem(item.id);
                        console.log(`🗑️ Deleted item: ${item.id}`);
                    }
                    
                    // Update or create items
                    for (const item of items) {
                        if (dbItemIds.has(item.id)) {
                            // Update existing item
                            await ItemService.updateItem(item.id, item);
                            console.log(`📝 Updated item: ${item.id}`);
                        } else {
                            // Create new item
                            await ItemService.createItem(currentBoardId, item);
                            console.log(`✨ Created new item: ${item.id} (type: ${item.type})`);
                        }
                    }
                    
                    console.log('✅ Items synced to database');
                }
            } catch (error) {
                console.error('❌ Failed to sync items to database:', error);
                console.error('Error details:', error);
            }
        };
        
        // Debounce to prevent excessive writes
        console.log('⏱️ Scheduling sync in 2 seconds...');
        const timeoutId = setTimeout(syncItems, 2000);
        return () => {
            console.log('🚫 Cancelled previous sync');
            clearTimeout(timeoutId);
        };
    }, [items, currentBoardId, isLoadingBoard, itemsInitialized, authToken, initialState.items]);


    // ZOOM: Plain scroll wheel zooms the canvas with smooth interpolation
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        // Smooth zoom animation loop
        const animateZoom = () => {
            if (!targetZoomRef.current) {
                zoomAnimationRef.current = null;
                return;
            }
            
            setPanZoom(prev => {
                const target = targetZoomRef.current!;
                const lerpFactor = 0.15; // Smoothing factor (0.1 = very smooth, 0.3 = snappier)
                
                const newK = prev.k + (target.k - prev.k) * lerpFactor;
                const newX = prev.x + (target.x - prev.x) * lerpFactor;
                const newY = prev.y + (target.y - prev.y) * lerpFactor;
                
                // Check if we're close enough to stop animating
                const kDiff = Math.abs(target.k - newK);
                const xDiff = Math.abs(target.x - newX);
                const yDiff = Math.abs(target.y - newY);
                
                if (kDiff < 0.001 && xDiff < 0.5 && yDiff < 0.5) {
                    targetZoomRef.current = null;
                    setIsZooming(false);
                    return { x: target.x, y: target.y, k: target.k };
                }
                
                return { x: newX, y: newY, k: newK };
            });
            
            zoomAnimationRef.current = requestAnimationFrame(animateZoom);
        };
        
        const handleWheel = (e: WheelEvent) => {
            // Don't zoom on items or during cropping
            if ((e.target as Element).closest('.board-item') || croppingItemId) return;
            
            e.preventDefault();
            setIsZooming(true);
            
            // Get mouse position relative to canvas
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            // Calculate zoom delta
            const zoomIntensity = 0.002;
            const delta = -e.deltaY * zoomIntensity;
            
            // Get current values (either from target or current state)
            setPanZoom(prev => {
                const currentK = targetZoomRef.current?.k ?? prev.k;
                const currentX = targetZoomRef.current?.x ?? prev.x;
                const currentY = targetZoomRef.current?.y ?? prev.y;
                
                // Calculate new zoom level
                const newK = Math.min(8, Math.max(0.1, currentK * (1 + delta)));
                
                // Zoom towards mouse position
                const worldX = (mouseX - currentX) / currentK;
                const worldY = (mouseY - currentY) / currentK;
                const newX = mouseX - worldX * newK;
                const newY = mouseY - worldY * newK;
                
                // Update target
                targetZoomRef.current = { k: newK, x: newX, y: newY };
                
                // Start animation if not already running
                if (!zoomAnimationRef.current) {
                    zoomAnimationRef.current = requestAnimationFrame(animateZoom);
                }
                
                return prev; // Don't update immediately, let animation handle it
            });
        };
        
        canvas.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            canvas.removeEventListener('wheel', handleWheel);
            if (zoomAnimationRef.current) {
                cancelAnimationFrame(zoomAnimationRef.current);
            }
            if (zoomTimeoutRef.current) {
                clearTimeout(zoomTimeoutRef.current);
            }
        };
    }, [croppingItemId]);

    const updateItem = useCallback((itemId: string, updates: Partial<BoardItem>) => {
        const newItems = items.map(item => item.id === itemId ? { ...item, ...updates } : item);
        pushToHistory(newItems);
    }, [items, pushToHistory]);

    const changeTextColor = useCallback((color: string) => {
        if (selectedItemIds.size === 0) return;
        const newItems = items.map(item => selectedItemIds.has(item.id) ? { ...item, textColor: color } : item);
        pushToHistory(newItems);
    }, [selectedItemIds, items, pushToHistory]);

    const changeBackgroundColor = useCallback((color: string) => {
        if (selectedItemIds.size === 0) return;
        const newTextColor = getContrastingTextColor(color);
        const newItems = items.map(item => {
            if (selectedItemIds.has(item.id)) {
                // Only change text color for items that can have a background
                const canHaveBg = item.type === ItemType.StickyNote || item.type === ItemType.Shape;
                return { 
                    ...item, 
                    backgroundColor: color,
                    // Conditionally update textColor to maintain contrast
                    ...(canHaveBg && { textColor: newTextColor })
                };
            }
            return item;
        });
        pushToHistory(newItems);
    }, [selectedItemIds, items, pushToHistory]);

    const changeFontFamily = useCallback((font: string) => {
        if (selectedItemIds.size === 0) return;
        const newItems = items.map(item => selectedItemIds.has(item.id) ? { ...item, fontFamily: font } : item);
        pushToHistory(newItems);
    }, [selectedItemIds, items, pushToHistory]);

    const changeFontSize = useCallback((delta: number) => {
        if (selectedItemIds.size === 0) return;
        const newItems = items.map(item => {
            if (selectedItemIds.has(item.id)) {
                const currentSize = item.fontSize || 16;
                const newSize = Math.max(8, Math.min(200, currentSize + delta));
                return { ...item, fontSize: newSize, originalFontSize: newSize };
            }
            return item;
        });
        pushToHistory(newItems);
    }, [selectedItemIds, items, pushToHistory]);

    const bringToFront = useCallback((itemIds: Set<string>) => {
        // Recalculate max from current items to ensure we're always above everything
        const currentMax = items.length > 0 ? Math.max(...items.map(i => i.zIndex)) : 0;
        const newZ = currentMax + 1;
        maxZIndex.current = newZ; // Update the cached value
        const newItems = items.map(item => itemIds.has(item.id) ? { ...item, zIndex: newZ } : item);
        console.log('🔝 bringToFront:', { itemIds: Array.from(itemIds), previousMax: currentMax, newZ });
        pushToHistory(newItems);
    }, [items, pushToHistory]);
    
    const sendToBack = useCallback((itemIds: Set<string>) => {
        // Calculate min from current items
        const currentMin = items.length > 0 ? Math.min(...items.map(i => i.zIndex)) : 0;
        const newZ = currentMin - 1;
        const newItems = items.map(item => itemIds.has(item.id) ? { ...item, zIndex: newZ } : item);
        console.log('🔽 sendToBack:', { itemIds: Array.from(itemIds), previousMin: currentMin, newZ });
        pushToHistory(newItems);
    }, [items, pushToHistory]);
    
    // Select an item without starting drag (for drawing tool mode)
    const selectItemOnly = useCallback((itemId: string) => {
        setSelectedItemIds(new Set([itemId]));
    }, []);

    const handleAddItem = useCallback((type: ItemType, options?: Partial<BoardItem>, mouseX?: number, mouseY?: number, useCanvasCoords?: boolean) => {
        console.log('🏗️ handleAddItem called with:', { type, options, mouseX, mouseY, useCanvasCoords });
        if (!canvasRef.current) {
            console.error('❌ canvasRef.current is null!');
            return;
        }
        const { width, height } = canvasRef.current.getBoundingClientRect();
        
        let targetX: number, targetY: number;
        
        if (mouseX !== undefined && mouseY !== undefined) {
            if (useCanvasCoords) {
                // Use coordinates directly as canvas coordinates
                targetX = mouseX;
                targetY = mouseY;
            } else {
                // Use mouse coordinates - convert screen coordinates to canvas coordinates
                const canvasCoords = screenToCanvasCoordinates(mouseX, mouseY, canvasRef.current, panZoom);
                targetX = canvasCoords.x;
                targetY = canvasCoords.y;
            }
        } else {
            // Fallback to center position - convert screen center to canvas coordinates
            const centerScreenX = width / 2;
            const centerScreenY = height / 2;
            const centerCanvasCoords = screenToCanvasCoordinates(centerScreenX, centerScreenY, canvasRef.current, panZoom);
            targetX = centerCanvasCoords.x;
            targetY = centerCanvasCoords.y;
            if (type === ItemType.NoteCard) {
                const noteCount = items.filter(item => item.type === ItemType.NoteCard).length;
                targetX += (noteCount % 3) * 300;
                targetY += Math.floor(noteCount / 3) * 210;
            }
        }

        maxZIndex.current += 1;

        // Base item with universal properties
        let newItem: BoardItem = {
            id: `item_${Date.now()}`,
            type,
            x: 0, // Will be set later
            y: 0, // Will be set later
            width: 150,
            height: 150,
            text: '',
            backgroundColor: '#fff38a',
            zIndex: maxZIndex.current,
            votes: 0,
            shape: ShapeType.Rectangle,
            textColor: '#000000', // Default to black for the default yellow sticky
            fontFamily: 'Inter, sans-serif',
            fontSize: 16,
            rotation: 0,
        };

        // Apply type-specific defaults
        if (type === ItemType.TextBox) {
            newItem = {
                ...newItem,
                backgroundColor: 'transparent',
                height: 50,
                text: 'Text',
                fontSize: 24,
                originalFontSize: 24, // Set baseline font size for scaling
                originalWidth: 150,   // Set baseline width for scaling  
                originalHeight: 50,   // Set baseline height for scaling
                textColor: '#FFFFFF', // White for text on dark background
            };
        }
        if (type === ItemType.Frame) {
            newItem = {
                ...newItem,
                width: 400,
                height: 300,
                backgroundColor: '#6b7280', // Default gray border color
                text: 'Frame',
            };
        }
        if (type === ItemType.YouTubeVideo) {
            newItem = {
                ...newItem,
                width: 480,
                height: 270, // 16:9 aspect ratio
                originalWidth: 480,  // Store original dimensions for aspect ratio reference
                originalHeight: 270,
                text: 'YouTube Video',
                backgroundColor: 'transparent',
            };
        }
        if (type === ItemType.NoteCard) {
            newItem = {
                ...newItem,
                width: 280,
                height: 180,
                text: '',
                backgroundColor: '#111827',
                textColor: '#f9fafb',
            };
        }

        // Apply user-provided options, which will override any defaults
        if (options) {
            newItem = { ...newItem, ...options };
        }

        // Finally, set the position based on target coordinates (mouse or center)
        newItem.x = targetX - newItem.width / 2;
        newItem.y = targetY - newItem.height / 2;
        
        // DEBUG: Log final item positioning
        console.log('=== ITEM POSITIONING DEBUG ===');
        console.log('Target coords (canvas):', { targetX, targetY });
        console.log('Item dimensions:', { width: newItem.width, height: newItem.height });
        console.log('Final item position:', { x: newItem.x, y: newItem.y });
        console.log('Item will be centered at:', { 
            centerX: newItem.x + newItem.width / 2, 
            centerY: newItem.y + newItem.height / 2 
        });

        pushToHistory([...items, newItem]);
    }, [panZoom, items, pushToHistory]);
    
    const duplicateItems = useCallback((itemIds: Set<string>, offsetX: number = 20, offsetY: number = 20): Map<string, string> => {
        const itemMap = new Map<string, BoardItem>(items.map((item) => [item.id, item] as const));
        const duplicatedItems: BoardItem[] = [];
        const oldToNewIdMap = new Map<string, string>();
        
        itemIds.forEach(itemId => {
            const originalItem = itemMap.get(itemId);
            if (!originalItem) return;
            
            maxZIndex.current += 1;
            const newId = `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            const duplicatedItem: BoardItem = {
                ...originalItem,
                id: newId,
                x: originalItem.x + offsetX,
                y: originalItem.y + offsetY,
                zIndex: maxZIndex.current,
                votes: 0, // Reset votes for duplicated items
            };
            
            duplicatedItems.push(duplicatedItem);
            oldToNewIdMap.set(itemId, newId);
        });
        
        if (duplicatedItems.length > 0) {
            pushToHistory([...items, ...duplicatedItems]);
        }
        
        return oldToNewIdMap;
    }, [items, pushToHistory]);

    const handleFileDrop = useCallback((files: FileList, x: number, y: number) => {
        const readAsDataUrl = (file: File) =>
            new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    if (!reader.result) return reject(new Error('Failed to read file'));
                    resolve(reader.result as string);
                };
                reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
                reader.readAsDataURL(file);
            });

        const canvasToBlob = (canvas: HTMLCanvasElement) =>
            new Promise<Blob>((resolve, reject) => {
                canvas.toBlob((blob) => {
                    if (!blob) return reject(new Error('Failed to encode image'));
                    resolve(blob);
                }, 'image/png');
            });

        Array.from(files).forEach(async (file) => {
            try {
                if (file.type.startsWith('image/')) {
                    const objectUrl = URL.createObjectURL(file);
                    const img = new Image();
                    img.onload = async () => {
                        try {
                            const MAX_DIMENSION = 500;
                            let width = img.width;
                            let height = img.height;
                            if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
                                const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
                                width *= ratio;
                                height *= ratio;
                            }

                            let src: string;
                            if (authToken) {
                                const uploaded = await api.uploadImage(file);
                                src = uploaded.url;
                            } else {
                                src = await readAsDataUrl(file);
                            }

                            maxZIndex.current += 1;
                            const newImageItem: BoardItem = {
                                id: `item_${Date.now()}_${Math.random()}`,
                                type: ItemType.Image,
                                x: x - width / 2,
                                y: y - height / 2,
                                width,
                                height,
                                zIndex: maxZIndex.current,
                                src,
                                text: file.name,
                                backgroundColor: '',
                                votes: 0,
                                originalWidth: img.width,
                                originalHeight: img.height,
                            };

                            pushToHistory([...itemsRef.current, newImageItem]);
                        } finally {
                            URL.revokeObjectURL(objectUrl);
                        }
                    };
                    img.onerror = () => URL.revokeObjectURL(objectUrl);
                    img.src = objectUrl;
                    return;
                }

                if (file.type === 'application/pdf') {
                    const arrayBuffer = await file.arrayBuffer();
                    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
                    const page = await pdf.getPage(1);
                    const scale = 1.5;
                    const viewport = page.getViewport({ scale });

                    const canvas = document.createElement('canvas');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    const context = canvas.getContext('2d');
                    if (!context) return;

                    await page.render({ canvas, canvasContext: context, viewport }).promise;

                    const MAX_DIMENSION = 800;
                    let width = canvas.width;
                    let height = canvas.height;
                    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
                        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
                        width *= ratio;
                        height *= ratio;
                    }

                    let src: string;
                    if (authToken) {
                        const blob = await canvasToBlob(canvas);
                        const uploadFile = new File([blob], `${file.name}-page1.png`, { type: 'image/png' });
                        const uploaded = await api.uploadImage(uploadFile);
                        src = uploaded.url;
                    } else {
                        src = canvas.toDataURL('image/png');
                    }

                    maxZIndex.current += 1;
                    const newPdfImageItem: BoardItem = {
                        id: `item_${Date.now()}_${Math.random()}`,
                        type: ItemType.Image,
                        x: x - width / 2,
                        y: y - height / 2,
                        width,
                        height,
                        zIndex: maxZIndex.current,
                        src,
                        text: `${file.name} (Page 1)`,
                        backgroundColor: '',
                        votes: 0,
                    };
                    pushToHistory([...itemsRef.current, newPdfImageItem]);
                }
            } catch (error) {
                console.error('Failed to process dropped file:', error);
                alert('Sorry, there was an error processing that file.');
            }
        });
    }, [authToken, pushToHistory]);

    const handleItemMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>, itemId: string) => {
        // Ignore middle mouse button - allow panning without moving objects
        if (e.button === 1) return;
        
        e.stopPropagation();

        dragInfo.current.isDragging = true;
        dragInfo.current.hasDragged = false;
        dragInfo.current.startX = e.clientX;
        dragInfo.current.startY = e.clientY;
        dragInfo.current.copiedItemIds = new Set();
        dragInfo.current.resizeStartDimensions = null;

        const newSelectedIds = new Set<string>(selectedItemIds);
        const wasAlreadySelected = selectedItemIds.has(itemId);
        
        console.log('handleItemMouseDown:', { 
            itemId, 
            shiftKey: e.shiftKey, 
            altKey: e.altKey,
            wasAlreadySelected, 
            selectedItemIds: Array.from(selectedItemIds) 
        });
        
        // Shift+click on unselected item toggles selection
        // Shift+drag on selected item will copy (handled below)
        if (e.shiftKey && !wasAlreadySelected) {
            newSelectedIds.add(itemId);
        } else if (!e.shiftKey && !e.altKey && !newSelectedIds.has(itemId)) {
            newSelectedIds.clear();
            newSelectedIds.add(itemId);
        }
        
        // Copy operation: Alt+drag OR Shift+drag on already selected item
        const shouldCopy = e.altKey || (e.shiftKey && wasAlreadySelected);
        dragInfo.current.isCopyOperation = shouldCopy;
        
        console.log('Copy decision:', { shouldCopy, newSelectedIds: Array.from(newSelectedIds) });

        // Handle copy operation (Alt+drag or Shift+drag)
        if (shouldCopy) {
            console.log('Triggering copy operation!');
            // Create copies of all selected items with no offset (they'll be positioned by the drag)
            const oldToNewIdMap = duplicateItems(newSelectedIds, 0, 0);
            console.log('Duplicated items:', Array.from(oldToNewIdMap.entries()));
            
            // Switch selection to the copied items
            const copiedIds = new Set(oldToNewIdMap.values());
            setSelectedItemIds(copiedIds);
            dragInfo.current.copiedItemIds = copiedIds;
            bringToFront(copiedIds);
            
            // Set up drag positions for the copied items using original item positions
            const currentItems = new Map<string, BoardItem>(items.map((item) => [item.id, item] as const));
            const startPositions = new Map<string, { x: number; y: number }>();
            // Map the copied items to the original positions
            oldToNewIdMap.forEach((newId, originalId) => {
                const originalItem = currentItems.get(originalId);
                if (originalItem) {
                    startPositions.set(newId, { x: originalItem.x, y: originalItem.y });
                }
            });
            dragInfo.current.itemStartPositions = startPositions;
        } else {
            // Normal drag operation - no automatic z-index changes
            // Users can manually use "Bring to Front" / "Send to Back" buttons
            setSelectedItemIds(newSelectedIds);
            
            const currentItems = new Map<string, BoardItem>(items.map((item) => [item.id, item] as const));
            const startPositions = new Map<string, { x: number; y: number }>();
            const frameChildrenIds = new Set<string>();
            
            newSelectedIds.forEach(id => {
                const item = currentItems.get(id);
                if (item) {
                    startPositions.set(id, { x: item.x, y: item.y });
                    
                    // If this is a frame, also track all items inside it
                    if (item.type === ItemType.Frame) {
                        const childItems = getItemsInsideFrame(item, items);
                        childItems.forEach(child => {
                            if (!newSelectedIds.has(child.id)) {
                                frameChildrenIds.add(child.id);
                                startPositions.set(child.id, { x: child.x, y: child.y });
                            }
                        });
                    }
                }
            });
            dragInfo.current.itemStartPositions = startPositions;
            dragInfo.current.frameChildrenIds = frameChildrenIds;
        }

    }, [selectedItemIds, bringToFront, items, duplicateItems]);
    
    const handleResizeMouseDown = useCallback((e: React.MouseEvent, itemId: string, handle: string) => {
        // Ignore middle mouse button - allow panning without triggering resize
        if (e.button === 1) return;
        
        e.stopPropagation();
        const item = items.find(i => i.id === itemId);
        if (!item) return;

        dragInfo.current = {
            ...dragInfo.current,
            isDragging: false,
            isResizing: true,
            isRotating: false,
            resizeHandle: handle,
            startX: e.clientX,
            startY: e.clientY,
            itemStartForResize: item,
            resizeStartDimensions: {
                width: item.width,
                height: item.height,
                aspectRatio: item.height !== 0 ? item.width / item.height : 1
            }
        };
    }, [items]);
    
    const handleRotationMouseDown = useCallback((e: React.MouseEvent, itemId: string) => {
        // Ignore middle mouse button - allow panning without triggering rotation
        if (e.button === 1) return;
        
        e.stopPropagation();
        const item = items.find(i => i.id === itemId);
        if (!item || !canvasRef.current) return;
        
        const itemRect = (e.target as Element).closest('.board-item')?.getBoundingClientRect();
        if (!itemRect) return;

        const itemCenterX = itemRect.left + itemRect.width / 2;
        const itemCenterY = itemRect.top + itemRect.height / 2;
        
        const startAngle = Math.atan2(e.clientY - itemCenterY, e.clientX - itemCenterX) * (180 / Math.PI);

        dragInfo.current = {
            ...dragInfo.current,
            isDragging: false,
            isResizing: false,
            isRotating: true,
            startX: e.clientX,
            startY: e.clientY,
            itemStartForRotation: item,
            rotationStartAngle: startAngle - (item.rotation || 0),
        };
    }, [items]);

    const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (e.button === 2) {
            if (!canvasRef.current) return;
            if ((e.target as Element).closest('.board-item')) return;
            e.preventDefault();
            const { x, y } = screenToCanvasCoordinates(e.clientX, e.clientY, canvasRef.current, panZoom);
            rightSelection.current = {
                active: true,
                startX: x,
                startY: y,
                currentX: x,
                currentY: y,
                didMove: false,
            };
            suppressContextMenuRef.current = false;
            setSelectionBox(null);
            setSelectedItemIds(new Set());
            setContextMenu(null);
            return;
        }

        if (e.button === 1) {
            e.preventDefault();
            setIsPanning(true);
            setPanStart({ x: e.clientX - panZoom.x, y: e.clientY - panZoom.y });
        } else if (e.target === canvasRef.current && e.button === 0) {
            setIsPanning(true);
            setPanStart({ x: e.clientX - panZoom.x, y: e.clientY - panZoom.y });
        }
    }, [panZoom, setContextMenu]);

    const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (rightSelection.current.active && canvasRef.current) {
            const { x, y } = screenToCanvasCoordinates(e.clientX, e.clientY, canvasRef.current, panZoom);
            rightSelection.current.currentX = x;
            rightSelection.current.currentY = y;

            const movedX = Math.abs(x - rightSelection.current.startX);
            const movedY = Math.abs(y - rightSelection.current.startY);
            if (!rightSelection.current.didMove && (movedX > 2 || movedY > 2)) {
                rightSelection.current.didMove = true;
                suppressContextMenuRef.current = true;
            }

            if (rightSelection.current.didMove) {
                const rectX = Math.min(rightSelection.current.startX, x);
                const rectY = Math.min(rightSelection.current.startY, y);
                const rectWidth = Math.abs(x - rightSelection.current.startX);
                const rectHeight = Math.abs(y - rightSelection.current.startY);
                const rect = {
                    x: rectX,
                    y: rectY,
                    width: rectWidth,
                    height: rectHeight,
                };
                setSelectionBox(rect);

                if (rectWidth > 0 && rectHeight > 0) {
                    const newlySelected = new Set<string>();
                    items.forEach(item => {
                        const itemLeft = item.x;
                        const itemRight = item.x + item.width;
                        const itemTop = item.y;
                        const itemBottom = item.y + item.height;
                        if (itemRight >= rect.x && itemLeft <= rect.x + rect.width && itemBottom >= rect.y && itemTop <= rect.y + rect.height) {
                            newlySelected.add(item.id);
                        }
                    });
                    setSelectedItemIds(newlySelected);
                } else {
                    setSelectedItemIds(new Set());
                }
            }
            return;
        }

        // Handle canvas panning
        if (isPanning) {
            setPanZoom(prev => ({
                ...prev,
                x: e.clientX - panStart.x,
                y: e.clientY - panStart.y
            }));
            return;
        }
        
        if (dragInfo.current.isRotating && dragInfo.current.itemStartForRotation) {
            const item = dragInfo.current.itemStartForRotation;
            const itemElement = document.querySelector(`[data-item-id="${item.id}"]`);
            if (!itemElement) return;

            const itemRect = itemElement.getBoundingClientRect();
            const itemCenterX = itemRect.left + itemRect.width / 2;
            const itemCenterY = itemRect.top + itemRect.height / 2;

            const currentAngle = Math.atan2(e.clientY - itemCenterY, e.clientX - itemCenterX) * (180 / Math.PI);
            const newRotation = currentAngle - dragInfo.current.rotationStartAngle;
            
            updateItem(item.id, { rotation: newRotation });

        } else if (dragInfo.current.isResizing && dragInfo.current.itemStartForResize && dragInfo.current.resizeHandle) {
            const startItem = dragInfo.current.itemStartForResize;
            const handle = dragInfo.current.resizeHandle;
            
            const dx = (e.clientX - dragInfo.current.startX) / panZoom.k;
            const dy = (e.clientY - dragInfo.current.startY) / panZoom.k;
            
            const angleRad = (startItem.rotation || 0) * (Math.PI / 180);
            const cos = Math.cos(angleRad);
            const sin = Math.sin(angleRad);

            let { x, y } = startItem;
            const minSize = 20;

            const rotatedDx = dx * cos + dy * sin;
            const rotatedDy = -dx * sin + dy * cos;

            let dw = 0;
            let dh = 0;

            if (handle.includes('right')) dw += rotatedDx;
            if (handle.includes('left')) dw -= rotatedDx;
            if (handle.includes('bottom')) dh += rotatedDy;
            if (handle.includes('top')) dh -= rotatedDy;
            
            // YouTube video aspect ratio handling
            if (startItem.type === ItemType.YouTubeVideo) {
                const aspectRatio = 16 / 9; // Standard YouTube aspect ratio
                
                // For corner handles, maintain aspect ratio by using the dominant direction
                if ((handle.includes('left') || handle.includes('right')) && 
                    (handle.includes('top') || handle.includes('bottom'))) {
                    // Corner handle - prioritize the direction with larger movement
                    const absDw = Math.abs(dw);
                    const absDh = Math.abs(dh);
                    
                    if (absDw >= absDh) {
                        // Width is dominant - calculate height from width
                        const newWidth = Math.max(minSize, startItem.width + dw);
                        const newHeight = newWidth / aspectRatio;
                        dh = newHeight - startItem.height;
                    } else {
                        // Height is dominant - calculate width from height  
                        const newHeight = Math.max(minSize, startItem.height + dh);
                        const newWidth = newHeight * aspectRatio;
                        dw = newWidth - startItem.width;
                    }
                } else if (handle.includes('left') || handle.includes('right')) {
                    // Side handle (left/right only) - adjust height to maintain aspect ratio
                    const newWidth = Math.max(minSize, startItem.width + dw);
                    const newHeight = newWidth / aspectRatio;
                    dh = newHeight - startItem.height;
                } else if (handle.includes('top') || handle.includes('bottom')) {
                    // Top/bottom handle only - adjust width to maintain aspect ratio
                    const newHeight = Math.max(minSize, startItem.height + dh);
                    const newWidth = newHeight * aspectRatio;
                    dw = newWidth - startItem.width;
                }
            }

            const proposedWidth = Math.max(minSize, startItem.width + dw);
            const proposedHeight = Math.max(minSize, startItem.height + dh);

            let width = proposedWidth;
            let height = proposedHeight;

            const aspectData = dragInfo.current.resizeStartDimensions;
            if (e.shiftKey && aspectData) {
                const aspectRatio = aspectData.aspectRatio || 1;
                if (aspectRatio > 0) {
                    const hasHorizontalHandle = handle.includes('left') || handle.includes('right');
                    const hasVerticalHandle = handle.includes('top') || handle.includes('bottom');
                    const widthDelta = Math.abs(proposedWidth - aspectData.width);
                    const heightDelta = Math.abs(proposedHeight - aspectData.height);

                    const adjustUsingWidth = (hasHorizontalHandle && !hasVerticalHandle) ||
                        (hasHorizontalHandle && hasVerticalHandle && widthDelta >= heightDelta);

                    if (adjustUsingWidth) {
                        width = proposedWidth;
                        height = width / aspectRatio;
                    } else {
                        height = proposedHeight;
                        width = height * aspectRatio;
                    }

                    if (height < minSize) {
                        height = minSize;
                        width = height * aspectRatio;
                    }
                    if (width < minSize) {
                        width = minSize;
                        height = width / aspectRatio;
                    }
                }
            }

            const widthChange = width - startItem.width;
            const heightChange = height - startItem.height;

            if (handle.includes('left')) {
                x -= widthChange * cos;
                y -= widthChange * sin;
            }
            if (handle.includes('top')) {
                x += heightChange * sin;
                y -= heightChange * cos;
            }

            const updates: Partial<BoardItem> = { x, y, width, height };
            
            // For TextBox items: set baseline values if they don't exist (for existing items)
            if (startItem.type === ItemType.TextBox && !startItem.originalWidth) {
                updates.originalWidth = startItem.width;
                updates.originalHeight = startItem.height;
                if (startItem.fontSize && !startItem.originalFontSize) {
                    updates.originalFontSize = startItem.fontSize;
                }
            }
            
            updateItem(startItem.id, updates);

        } else if (dragInfo.current.isDragging) {
            dragInfo.current.hasDragged = true;
            const dx = (e.clientX - dragInfo.current.startX) / panZoom.k;
            const dy = (e.clientY - dragInfo.current.startY) / panZoom.k;
            
            // Update visual state during drag for immediate feedback
            // Include both selected items and frame children
            setItems(currentItems => currentItems.map(item => {
                if (selectedItemIds.has(item.id) || dragInfo.current.frameChildrenIds.has(item.id)) {
                    const startPos = dragInfo.current.itemStartPositions.get(item.id);
                    if (startPos) {
                        return { ...item, x: startPos.x + dx, y: startPos.y + dy };
                    }
                }
                return item;
            }));
        }
    }, [isPanning, panStart, panZoom, items, selectedItemIds, updateItem]);

    const handleCanvasMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (rightSelection.current.active) {
            const { didMove, startX, startY, currentX, currentY } = rightSelection.current;
            rightSelection.current = {
                active: false,
                startX: 0,
                startY: 0,
                currentX: 0,
                currentY: 0,
                didMove: false,
            };
            const rectWidth = Math.abs(currentX - startX);
            const rectHeight = Math.abs(currentY - startY);
            if (didMove && rectWidth > 0 && rectHeight > 0) {
                const rect = {
                    x: Math.min(startX, currentX),
                    y: Math.min(startY, currentY),
                    width: rectWidth,
                    height: rectHeight,
                };
                const ids = new Set<string>();
                items.forEach(item => {
                    const itemLeft = item.x;
                    const itemRight = item.x + item.width;
                    const itemTop = item.y;
                    const itemBottom = item.y + item.height;
                    if (itemRight >= rect.x && itemLeft <= rect.x + rect.width && itemBottom >= rect.y && itemTop <= rect.y + rect.height) {
                        ids.add(item.id);
                    }
                });
                if (ids.size > 0) {
                    const remaining = items.filter(item => !ids.has(item.id));
                    pushToHistory(remaining);
                    setSelectedItemIds(new Set());
                    setContextMenu(null);
                } else {
                    setSelectedItemIds(new Set());
                }
            }
            setSelectionBox(null);
            suppressContextMenuRef.current = false;
            return;
        }

        // Stop canvas panning
        if (isPanning) {
            setIsPanning(false);
        }
        
        const isInteractingWithItem = !!(e.target as Element).closest('.board-item');
        const isInteractingWithToolbar = !!(e.target as Element).closest('.contextual-toolbar');

        // Save drag changes to history when drag ends
        if (dragInfo.current.isDragging && dragInfo.current.hasDragged) {
            // Calculate final positions and push to history
            const dx = (e.clientX - dragInfo.current.startX) / panZoom.k;
            const dy = (e.clientY - dragInfo.current.startY) / panZoom.k;
            
            // Include both selected items and frame children in final positions
            const finalItems = items.map(item => {
                if (selectedItemIds.has(item.id) || dragInfo.current.frameChildrenIds.has(item.id)) {
                    const startPos = dragInfo.current.itemStartPositions.get(item.id);
                    if (startPos) {
                        return { ...item, x: startPos.x + dx, y: startPos.y + dy };
                    }
                }
                return item;
            });
            
            pushToHistory(finalItems);
        }

        if (!dragInfo.current.isDragging && !dragInfo.current.isResizing && !dragInfo.current.isRotating && !isInteractingWithItem && !isInteractingWithToolbar) {
            setSelectedItemIds(new Set());
        }
        
        // Clean up drag and copy operation state
        dragInfo.current.isResizing = false;
        dragInfo.current.isDragging = false;
        dragInfo.current.isRotating = false;
        dragInfo.current.isCopyOperation = false;
        dragInfo.current.copiedItemIds = new Set();
        dragInfo.current.frameChildrenIds = new Set();
        dragInfo.current.resizeStartDimensions = null;
    }, [isPanning, items, selectedItemIds, panZoom, pushToHistory]);
    
    const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const isClickOnItem = !!(e.target as Element).closest('.board-item');
        const isClickOnToolbar = !!(e.target as Element).closest('.contextual-toolbar');
        
        if (!dragInfo.current.hasDragged && !isClickOnItem && !isClickOnToolbar) {
            setSelectedItemIds(new Set());
            setEditingItemId(null);
            setInteractiveItemId(null);
        }
        setContextMenu(null);
    }, []);
    
    const handleItemDoubleClick = useCallback((itemId: string) => {
        const item = items.find(i => i.id === itemId);
        if (!item) return;

        if (item.type === ItemType.YouTubeVideo) {
            setInteractiveItemId(itemId);
        } else if (item.type !== ItemType.Image) {
            setEditingItemId(itemId);
        }
    }, [items]);

    const handleTextChange = useCallback((itemId: string, newText: string) => {
        updateItem(itemId, { text: newText });
    }, [updateItem]);

    const handleCanvasContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (suppressContextMenuRef.current) {
            e.preventDefault();
            suppressContextMenuRef.current = false;
            return;
        }
        e.preventDefault();
        const target = e.target as Element;
        const itemElement = target.closest('.board-item');
        if (itemElement) {
            const itemId = itemElement.getAttribute('data-item-id');
            if(itemId){
                if (!selectedItemIds.has(itemId)) {
                    setSelectedItemIds(new Set([itemId]));
                }
                setContextMenu({ x: e.clientX, y: e.clientY, itemIds: [itemId] });
            }
        }
    }, [selectedItemIds]);
    
    const closeContextMenu = useCallback(() => setContextMenu(null), []);

    const deleteItems = useCallback((ids: Set<string>) => {
        const newItems = items.filter(item => !ids.has(item.id));
        pushToHistory(newItems);
        setSelectedItemIds(new Set());
        setContextMenu(null);
    }, [items, pushToHistory]);

    const handleDelete = useCallback(() => {
        if (contextMenu) {
            deleteItems(new Set(contextMenu.itemIds));
        } else {
            deleteItems(selectedItemIds);
        }
    }, [contextMenu, selectedItemIds, deleteItems]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Undo with Ctrl+Z
            if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                if (canUndo) {
                    undo();
                    setSelectedItemIds(new Set()); // Clear selection after undo
                    console.log('🔄 UNDO: Restored previous state');
                }
                return;
            }
            
            // Redo with Ctrl+Y or Ctrl+Shift+Z
            if (e.ctrlKey && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                if (canRedo) {
                    redo();
                    setSelectedItemIds(new Set()); // Clear selection after redo
                    console.log('🔄 REDO: Applied next state');
                }
                return;
            }
            
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedItemIds.size > 0 && !editingItemId) {
                deleteItems(selectedItemIds);
            }
            if (e.key === 'Escape') {
                if (editingItemId) setEditingItemId(null);
                if (selectedItemIds.size > 0) setSelectedItemIds(new Set());
                if (croppingItemId) handleCancelCrop();
                if (interactiveItemId) setInteractiveItemId(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedItemIds, editingItemId, deleteItems, croppingItemId, interactiveItemId, canUndo, canRedo, undo, redo]);

    const handleAddVote = useCallback(() => {
        if (contextMenu) {
            const newItems = items.map(item => contextMenu.itemIds.includes(item.id) ? { ...item, votes: item.votes + 1 } : item);
            pushToHistory(newItems);
        }
        closeContextMenu();
    }, [contextMenu, closeContextMenu, items, pushToHistory]);
    
    const handleBringToFront = useCallback(() => {
        if (contextMenu) bringToFront(new Set(contextMenu.itemIds));
        closeContextMenu();
    }, [contextMenu, closeContextMenu, bringToFront]);

    const handleSendToBack = useCallback(() => {
        if (contextMenu) sendToBack(new Set(contextMenu.itemIds));
        closeContextMenu();
    }, [contextMenu, closeContextMenu, sendToBack]);

    // Store mouse position for zoom centering
    const mousePosition = useRef({ x: 0, y: 0 });
    
    // Update mouse position tracking
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (canvasRef.current) {
                const rect = canvasRef.current.getBoundingClientRect();
                mousePosition.current = {
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top
                };
            }
        };
        
        if (canvasRef.current) {
            canvasRef.current.addEventListener('mousemove', handleMouseMove);
            return () => {
                if (canvasRef.current) {
                    canvasRef.current.removeEventListener('mousemove', handleMouseMove);
                }
            };
        }
    }, []);
    
    const zoomBy = useCallback((factor: number) => {
        if (!canvasRef.current) return;
        
        // Get current mouse position relative to canvas
        const mouseX = mousePosition.current.x;
        const mouseY = mousePosition.current.y;
        
        // Calculate the point in world coordinates that the mouse is over
        const worldX = (mouseX - panZoom.x) / panZoom.k;
        const worldY = (mouseY - panZoom.y) / panZoom.k;
        
        // Calculate new scale
        const newK = Math.min(8, Math.max(0.1, panZoom.k * factor));
        
        // Calculate new translation to keep the world point under the mouse
        const newX = mouseX - worldX * newK;
        const newY = mouseY - worldY * newK;
        
        // Apply the new transform
        setPanZoom({ x: newX, y: newY, k: newK });
    }, [panZoom]);
    
    const fitToScreen = useCallback(() => {
        const contentItems = itemsRef.current;
        if (!canvasRef.current || contentItems.length === 0) return;

        const { width: viewWidth, height: viewHeight } = canvasRef.current.getBoundingClientRect();
        
        const bounds = contentItems.reduce((acc, item) => ({
            minX: Math.min(acc.minX, item.x),
            minY: Math.min(acc.minY, item.y),
            maxX: Math.max(acc.maxX, item.x + item.width),
            maxY: Math.max(acc.maxY, item.y + item.height),
        }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });

        const contentWidth = bounds.maxX - bounds.minX;
        const contentHeight = bounds.maxY - bounds.minY;
        
        if (contentWidth <= 0 || contentHeight <= 0) return;

        const k = Math.min(viewWidth / contentWidth, viewHeight / contentHeight) * 0.9;
        const x = (viewWidth / 2) - (bounds.minX + contentWidth / 2) * k;
        const y = (viewHeight / 2) - (bounds.minY + contentHeight / 2) * k;
        
        // Apply the transform directly
        setPanZoom({ x, y, k });
    }, []);
    
    const centerContentBelowToolbar = useCallback(() => {
        // Use ref to get latest items state
        const contentItems = itemsRef.current;
        if (!canvasRef.current || contentItems.length === 0) return;

        const { width: viewWidth, height: viewHeight } = canvasRef.current.getBoundingClientRect();
        
        // Calculate bounding box of all items
        const bounds = contentItems.reduce((acc, item) => ({
            minX: Math.min(acc.minX, item.x),
            minY: Math.min(acc.minY, item.y),
            maxX: Math.max(acc.maxX, item.x + item.width),
            maxY: Math.max(acc.maxY, item.y + item.height),
        }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });

        const contentWidth = bounds.maxX - bounds.minX;
        const contentHeight = bounds.maxY - bounds.minY;
        
        if (contentWidth <= 0 || contentHeight <= 0) return;

        // Content center X and top Y in canvas coordinates
        const contentCenterX = bounds.minX + contentWidth / 2;
        const contentTopY = bounds.minY;

        // Toolbar offset from top + padding
        const toolbarOffset = 60;
        const topPadding = 120;
        
        // Target: horizontally centered, top of content below toolbar
        const targetScreenX = viewWidth / 2;
        const targetScreenY = toolbarOffset + topPadding;
        
        // Use zoom level 1 for simplicity (no scaling)
        const k = 1;
        
        // Calculate pan so that:
        // - Content center X appears at screen center X
        // - Content top Y appears just below toolbar
        const x = targetScreenX - contentCenterX * k;
        const y = targetScreenY - contentTopY * k;
        
        console.log('📐 Centering content:', { 
            contentCenterX, contentTopY,
            target: { x: targetScreenX, y: targetScreenY },
            pan: { x, y, k }
        });
        
        // Apply the transform
        setPanZoom({ x, y, k });
    }, []);
    
    const clearBoard = useCallback(() => {
        if (window.confirm("Are you sure you want to clear the entire board?")) {
            pushToHistory([]);
            setSelectedItemIds(new Set());
            setPanZoom({ x: 0, y: 0, k: 1 });
        }
    }, [pushToHistory]);
    
    const triggerDownload = (href: string, filename: string) => {
        const link = document.createElement('a');
        link.href = href;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Resolution presets for high-quality export
    type ExportResolution = '1K' | '2K' | '4K' | 'Original';
    const RESOLUTION_MAP: Record<ExportResolution, number> = {
        '1K': 1024,
        '2K': 2048,
        '4K': 4096,
        'Original': 0, // Use canvas bounds
    };

    /**
     * Professional-grade high-quality compositor export
     * Renders images and shapes directly to canvas at target resolution
     * Preserves alpha channels and applies proper compositing
     */
    const exportHighQuality = async (
        targetItems: BoardItem[],
        resolution: ExportResolution = '2K',
        format: 'png' | 'jpeg' = 'png',
        backgroundColor: string | null = null
    ): Promise<void> => {
        if (targetItems.length === 0) return;

        // Helper to load an image at full resolution
        const loadImage = (src: string): Promise<HTMLImageElement> => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
                img.src = src;
            });
        };

        // Helper to get image source from an item
        const getImageSrc = (item: BoardItem): string | undefined => {
            return item.generatedImageUrl || item.src;
        };

        // Calculate bounding box of all items
        const bounds = targetItems.reduce((acc, item) => ({
            minX: Math.min(acc.minX, item.x),
            minY: Math.min(acc.minY, item.y),
            maxX: Math.max(acc.maxX, item.x + item.width),
            maxY: Math.max(acc.maxY, item.y + item.height),
        }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });

        const canvasWidth = bounds.maxX - bounds.minX;
        const canvasHeight = bounds.maxY - bounds.minY;

        // Calculate uniform scale factor FIRST to avoid aspect ratio distortion
        // This ensures the same scale is used for both dimensions
        let scale: number;
        let targetWidth: number;
        let targetHeight: number;
        
        if (resolution === 'Original') {
            // Use 2x for quality on original size
            scale = 2;
        } else {
            // Scale based on the longest edge to fit target resolution
            const targetLongEdge = RESOLUTION_MAP[resolution];
            const longestEdge = Math.max(canvasWidth, canvasHeight);
            scale = targetLongEdge / longestEdge;
        }
        
        // Calculate target dimensions using the uniform scale
        // Use Math.round for final pixel dimensions, but scale is exact
        targetWidth = Math.round(canvasWidth * scale);
        targetHeight = Math.round(canvasHeight * scale);

        console.log(`[HQ Export] Resolution: ${resolution}, Target: ${targetWidth}x${targetHeight}, Scale: ${scale.toFixed(2)}x`);

        // Create high-resolution canvas
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d', { alpha: true });

        if (!ctx) {
            console.error('Failed to get canvas context');
            return;
        }

        // Configure for highest quality rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Fill background if specified (null = transparent)
        if (backgroundColor) {
            ctx.fillStyle = backgroundColor;
            ctx.fillRect(0, 0, targetWidth, targetHeight);
        }

        // Sort items by z-index for proper compositing order
        const sortedItems = [...targetItems].sort((a, b) => a.zIndex - b.zIndex);

        // Render each item
        for (const item of sortedItems) {
            const x = (item.x - bounds.minX) * scale;
            const y = (item.y - bounds.minY) * scale;
            const w = item.width * scale;
            const h = item.height * scale;
            const rotation = item.rotation || 0;

            ctx.save();

            // Apply rotation around item center if needed
            if (rotation !== 0) {
                const centerX = x + w / 2;
                const centerY = y + h / 2;
                ctx.translate(centerX, centerY);
                ctx.rotate((rotation * Math.PI) / 180);
                ctx.translate(-centerX, -centerY);
            }

            // Render based on item type
            if (item.type === ItemType.Image || getImageSrc(item)) {
                // Image item - load and draw at full quality with correct aspect ratio
                const src = getImageSrc(item);
                if (src) {
                    try {
                        const img = await loadImage(src);
                        
                        // Calculate dimensions that preserve aspect ratio (like object-fit: contain)
                        const imgAspect = img.naturalWidth / img.naturalHeight;
                        const itemAspect = w / h;
                        
                        let drawWidth = w;
                        let drawHeight = h;
                        let drawX = x;
                        let drawY = y;
                        
                        if (imgAspect > itemAspect) {
                            // Image is wider - fit to width, center vertically
                            drawHeight = w / imgAspect;
                            drawY = y + (h - drawHeight) / 2;
                        } else if (imgAspect < itemAspect) {
                            // Image is taller - fit to height, center horizontally
                            drawWidth = h * imgAspect;
                            drawX = x + (w - drawWidth) / 2;
                        }
                        
                        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
                    } catch (e) {
                        console.warn(`Failed to load image for item ${item.id}:`, e);
                    }
                }
            } else if (item.type === ItemType.Shape && item.shape) {
                // Shape item - render directly to canvas
                renderShapeToCanvas(ctx, item, x, y, w, h);
            } else if (item.type === ItemType.NoteCard) {
                const noteText = item.noteData ? `${item.noteData.title}\n${item.noteData.excerpt}` : 'Missing note';
                renderTextItemToCanvas(ctx, { ...item, text: noteText }, x, y, w, h, scale);
            } else if (item.type === ItemType.StickyNote || item.type === ItemType.TextBox || item.type === ItemType.ObsidianNote) {
                // Text items - render with background and text
                renderTextItemToCanvas(ctx, item, x, y, w, h, scale);
            } else if (item.type === ItemType.Frame) {
                // Frame - render as a dashed border with label
                ctx.strokeStyle = item.backgroundColor || '#6B7280';
                ctx.lineWidth = 2 * scale;
                ctx.setLineDash([8 * scale, 4 * scale]);
                ctx.strokeRect(x, y, w, h);
                ctx.setLineDash([]);
                // Draw frame label if present
                if (item.text) {
                    ctx.fillStyle = item.textColor || '#FFFFFF';
                    ctx.font = `${14 * scale}px sans-serif`;
                    ctx.fillText(item.text, x + 8 * scale, y + 20 * scale);
                }
            } else if (item.type === ItemType.YouTubeVideo) {
                // YouTube video - render as a placeholder with play icon
                ctx.fillStyle = '#1F2937';
                ctx.fillRect(x, y, w, h);
                ctx.fillStyle = '#EF4444';
                // Draw play button
                const iconSize = Math.min(w, h) * 0.3;
                const cx = x + w / 2;
                const cy = y + h / 2;
                ctx.beginPath();
                ctx.moveTo(cx - iconSize / 3, cy - iconSize / 2);
                ctx.lineTo(cx - iconSize / 3, cy + iconSize / 2);
                ctx.lineTo(cx + iconSize / 2, cy);
                ctx.closePath();
                ctx.fill();
            }

            ctx.restore();
        }

        // Export as data URL
        const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
        const quality = format === 'jpeg' ? 0.95 : undefined;
        const dataUrl = canvas.toDataURL(mimeType, quality);

        // Generate filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `export-${resolution}-${timestamp}.${format}`;

        triggerDownload(dataUrl, filename);
        console.log(`[HQ Export] Complete: ${filename} (${targetWidth}x${targetHeight})`);
    };

    /**
     * Render a shape directly to canvas context
     * Matches the SVG shapes in BoardItemComponent
     */
    const renderShapeToCanvas = (
        ctx: CanvasRenderingContext2D,
        item: BoardItem,
        x: number,
        y: number,
        w: number,
        h: number
    ) => {
        const shape = item.shape!;
        const fillColor = item.backgroundColor || '#3B82F6';
        const isLineOrArrow = [
            ShapeType.Line, ShapeType.ArrowUp, ShapeType.ArrowRight,
            ShapeType.ArrowDown, ShapeType.ArrowLeft, ShapeType.ArrowBoth
        ].includes(shape);

        ctx.fillStyle = fillColor;
        ctx.strokeStyle = fillColor;
        ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.05);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();

        switch (shape) {
            case ShapeType.Rectangle:
                const rr = Math.min(w, h) * 0.05; // Small radius
                ctx.roundRect(x, y, w, h, rr);
                break;

            case ShapeType.RoundedRectangle:
                const rrr = Math.min(w, h) * 0.15;
                ctx.roundRect(x, y, w, h, rrr);
                break;

            case ShapeType.Circle:
                const radius = Math.min(w, h) / 2;
                ctx.arc(x + w / 2, y + h / 2, radius, 0, Math.PI * 2);
                break;

            case ShapeType.Triangle:
                ctx.moveTo(x + w / 2, y);
                ctx.lineTo(x + w, y + h);
                ctx.lineTo(x, y + h);
                ctx.closePath();
                break;

            case ShapeType.Diamond:
                ctx.moveTo(x + w / 2, y);
                ctx.lineTo(x + w, y + h / 2);
                ctx.lineTo(x + w / 2, y + h);
                ctx.lineTo(x, y + h / 2);
                ctx.closePath();
                break;

            case ShapeType.Hexagon:
                ctx.moveTo(x + w * 0.25, y);
                ctx.lineTo(x + w * 0.75, y);
                ctx.lineTo(x + w, y + h * 0.5);
                ctx.lineTo(x + w * 0.75, y + h);
                ctx.lineTo(x + w * 0.25, y + h);
                ctx.lineTo(x, y + h * 0.5);
                ctx.closePath();
                break;

            case ShapeType.Line:
                ctx.moveTo(x, y + h / 2);
                ctx.lineTo(x + w, y + h / 2);
                break;

            case ShapeType.ArrowRight:
                drawArrowLine(ctx, x, y + h / 2, x + w, y + h / 2, Math.min(w, h) * 0.15);
                break;

            case ShapeType.ArrowLeft:
                drawArrowLine(ctx, x + w, y + h / 2, x, y + h / 2, Math.min(w, h) * 0.15);
                break;

            case ShapeType.ArrowDown:
                drawArrowLine(ctx, x + w / 2, y, x + w / 2, y + h, Math.min(w, h) * 0.15);
                break;

            case ShapeType.ArrowUp:
                drawArrowLine(ctx, x + w / 2, y + h, x + w / 2, y, Math.min(w, h) * 0.15);
                break;

            case ShapeType.ArrowBoth:
                drawArrowLine(ctx, x, y + h / 2, x + w, y + h / 2, Math.min(w, h) * 0.15, true);
                break;
        }

        if (isLineOrArrow) {
            ctx.stroke();
        } else {
            ctx.fill();
        }

        // Draw text if present
        if (item.text && !isLineOrArrow) {
            const fontSize = (item.fontSize || 16) * (w / item.width);
            ctx.fillStyle = item.textColor || '#FFFFFF';
            ctx.font = `${fontSize}px ${item.fontFamily || 'sans-serif'}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Word wrap text
            const maxWidth = w * 0.8;
            const words = item.text.split(' ');
            const lines: string[] = [];
            let currentLine = '';
            
            for (const word of words) {
                const testLine = currentLine ? `${currentLine} ${word}` : word;
                if (ctx.measureText(testLine).width <= maxWidth) {
                    currentLine = testLine;
                } else {
                    if (currentLine) lines.push(currentLine);
                    currentLine = word;
                }
            }
            if (currentLine) lines.push(currentLine);
            
            const lineHeight = fontSize * 1.2;
            const startY = y + h / 2 - ((lines.length - 1) * lineHeight) / 2;
            
            lines.forEach((line, i) => {
                ctx.fillText(line, x + w / 2, startY + i * lineHeight);
            });
        }
    };

    /**
     * Draw an arrow line with arrowhead(s)
     */
    const drawArrowLine = (
        ctx: CanvasRenderingContext2D,
        x1: number, y1: number,
        x2: number, y2: number,
        headSize: number,
        bothEnds: boolean = false
    ) => {
        const angle = Math.atan2(y2 - y1, x2 - x1);
        
        // Draw line
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        
        // Draw arrowhead at end
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(
            x2 - headSize * Math.cos(angle - Math.PI / 6),
            y2 - headSize * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
            x2 - headSize * Math.cos(angle + Math.PI / 6),
            y2 - headSize * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
        
        // Draw arrowhead at start if both ends
        if (bothEnds) {
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(
                x1 + headSize * Math.cos(angle - Math.PI / 6),
                y1 + headSize * Math.sin(angle - Math.PI / 6)
            );
            ctx.lineTo(
                x1 + headSize * Math.cos(angle + Math.PI / 6),
                y1 + headSize * Math.sin(angle + Math.PI / 6)
            );
            ctx.closePath();
            ctx.fill();
        }
    };

    /**
     * Render text items (sticky notes, text boxes) to canvas
     */
    const renderTextItemToCanvas = (
        ctx: CanvasRenderingContext2D,
        item: BoardItem,
        x: number,
        y: number,
        w: number,
        h: number,
        scale: number
    ) => {
        // Draw background
        ctx.fillStyle = item.backgroundColor || '#FEF3C7';
        const radius = Math.min(w, h) * 0.05;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, radius);
        ctx.fill();

        // Draw text
        if (item.text) {
            const fontSize = (item.fontSize || 16) * scale;
            ctx.fillStyle = item.textColor || '#000000';
            ctx.font = `${fontSize}px ${item.fontFamily || 'sans-serif'}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            const padding = w * 0.1;
            const maxWidth = w - padding * 2;
            const words = item.text.split(' ');
            const lines: string[] = [];
            let currentLine = '';
            
            for (const word of words) {
                const testLine = currentLine ? `${currentLine} ${word}` : word;
                if (ctx.measureText(testLine).width <= maxWidth) {
                    currentLine = testLine;
                } else {
                    if (currentLine) lines.push(currentLine);
                    currentLine = word;
                }
            }
            if (currentLine) lines.push(currentLine);
            
            const lineHeight = fontSize * 1.3;
            const startY = y + h / 2 - ((lines.length - 1) * lineHeight) / 2;
            
            lines.forEach((line, i) => {
                ctx.fillText(line, x + w / 2, startY + i * lineHeight);
            });
        }
    };

    // Export resolution state
    const [exportResolution, setExportResolution] = useState<ExportResolution>('2K');

    const exportToImage = async (format: 'png' | 'jpeg') => {
        if (items.length === 0) return;

        // Check if items are selected
        const selectedItems = items.filter(item => selectedItemIds.has(item.id));
        
        // Use high-quality compositor export for all items (supports images, shapes, text)
        // Export selected items if any, otherwise export ALL items
        const itemsToExport = selectedItems.length > 0 ? selectedItems : items;
        const bgColor = format === 'jpeg' ? '#111827' : null; // Transparent for PNG
        await exportHighQuality(itemsToExport, exportResolution, format, bgColor);
    };

    const exportToPDF = async () => {
        if (!itemsContainerRef.current || items.length === 0) return;
        setSelectedItemIds(new Set());
        await new Promise(resolve => setTimeout(resolve, 100));

        const bounds = items.reduce((acc, item) => ({
            minX: Math.min(acc.minX, item.x),
            minY: Math.min(acc.minY, item.y),
            maxX: Math.max(acc.maxX, item.x + item.width),
            maxY: Math.max(acc.maxY, item.y + item.height),
        }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });

        const PADDING = 20;
        const exportWidth = bounds.maxX - bounds.minX + PADDING * 2;
        const exportHeight = bounds.maxY - bounds.minY + PADDING * 2;

        const canvas = await html2canvas(itemsContainerRef.current, {
             backgroundColor: '#111827',
             width: itemsContainerRef.current.scrollWidth,
             height: itemsContainerRef.current.scrollHeight,
             scale: 2
        });

        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = exportWidth * 2;
        cropCanvas.height = exportHeight * 2;
        const ctx = cropCanvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(canvas, (bounds.minX-PADDING)*2, (bounds.minY-PADDING)*2, exportWidth*2, exportHeight*2, 0,0,exportWidth*2, exportHeight*2);

        const imgData = cropCanvas.toDataURL('image/jpeg', 0.95);
        const pdf = new jsPDF({
            orientation: exportWidth > exportHeight ? 'landscape' : 'portrait',
            unit: 'px',
            format: [exportWidth, exportHeight]
        });

        pdf.addImage(imgData, 'JPEG', 0, 0, exportWidth, exportHeight);
        pdf.save('board-export.pdf');
    };

    const exportToCSV = () => {
        if (items.length === 0) return;

        const headers = ['id', 'type', 'text', 'x', 'y', 'width', 'height', 'backgroundColor', 'textColor', 'fontSize', 'zIndex'];
        const rows = items.map(item => {
            const rowData = [
                item.id,
                item.type,
                `"${item.text.replace(/"/g, '""')}"`,
                item.x,
                item.y,
                item.width,
                item.height,
                item.backgroundColor,
                item.textColor || '',
                item.fontSize || '',
                item.zIndex
            ];
            return rowData.join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        triggerDownload(url, 'board-export.csv');
        URL.revokeObjectURL(url);
    };

    const handleExport = (format: 'PNG' | 'JPG' | 'PDF' | 'CSV') => {
        switch (format) {
            case 'PNG': exportToImage('png'); break;
            case 'JPG': exportToImage('jpeg'); break;
            case 'PDF': exportToPDF(); break;
            case 'CSV': exportToCSV(); break;
        }
    };
    
    // *** GENERATIVE AI LOGIC *** //
    const handleOpenGenerationModal = (itemId: string) => {
        setGenerationModal({ itemId });
    };

    const handleCloseGenerationModal = () => {
        setGenerationModal({ itemId: null });
    };

    const handleGenerateMedia = async () => {
        throw new Error('AI media generation is unavailable until a server-side provider is configured.');
    };
    
    const handleDownloadItem = useCallback((itemId: string) => {
        const item = items.find(i => i.id === itemId);
        if (item && item.generatedVideoUrl) {
            triggerDownload(item.generatedVideoUrl, `aisurftools-video-${item.id}.mp4`);
        }
    }, [items]);

    // *** IMAGE CROPPING LOGIC *** //
    const handleStartCrop = useCallback((itemId: string) => {
        setCroppingItemId(itemId);
        setSelectedItemIds(new Set()); // Deselect items to hide other UI
    }, []);

    const handleCancelCrop = useCallback(() => {
        setCroppingItemId(null);
    }, []);

    const handleApplyCrop = useCallback((itemId: string, crop: {x: number, y: number, width: number, height: number}) => {
        const item = items.find(i => i.id === itemId);
        if (!item || !item.originalWidth || !item.originalHeight) return;

        const scaleX = item.width / (item.crop?.width || item.originalWidth);
        const scaleY = item.height / (item.crop?.height || item.originalHeight);
        
        const newWidth = item.width * (crop.width / (item.crop?.width || item.originalWidth));
        const newHeight = item.height * (crop.height / (item.crop?.height || item.originalHeight));
        
        const newX = item.x + crop.x * scaleX;
        const newY = item.y + crop.y * scaleY;
        
        updateItem(itemId, {
            x: newX,
            y: newY,
            width: newWidth,
            height: newHeight,
            crop: crop
        });

        setCroppingItemId(null);
    }, [items, updateItem]);
    
    // *** NEW IMAGE FEATURES *** //
    const handleMaximizeImage = useCallback((itemId: string) => {
        const item = items.find(i => i.id === itemId);
        if (!item || !canvasRef.current) return;
        
        const { width: viewWidth, height: viewHeight } = canvasRef.current.getBoundingClientRect();
        const margin = 50;
        
        // Store original size and position
        const originalSize = { width: item.width, height: item.height };
        const originalPosition = { x: item.x, y: item.y };
        
        // Calculate new size maintaining aspect ratio
        const aspectRatio = item.width / item.height;
        const maxWidth = (viewWidth - margin * 2) / panZoom.k;
        const maxHeight = (viewHeight - margin * 2) / panZoom.k;
        
        let newWidth = maxWidth;
        let newHeight = maxWidth / aspectRatio;
        
        if (newHeight > maxHeight) {
            newHeight = maxHeight;
            newWidth = maxHeight * aspectRatio;
        }
        
        // Center the image
        const centerX = (-panZoom.x + viewWidth / 2) / panZoom.k;
        const centerY = (-panZoom.y + viewHeight / 2) / panZoom.k;
        const newX = centerX - newWidth / 2;
        const newY = centerY - newHeight / 2;
        
        updateItem(itemId, {
            width: newWidth,
            height: newHeight,
            x: newX,
            y: newY,
            isMaximized: true,
            originalSize,
            originalPosition
        });
    }, [items, canvasRef, panZoom, updateItem]);
    
    const handleMinimizeImage = useCallback((itemId: string) => {
        const item = items.find(i => i.id === itemId);
        if (!item || !item.originalSize || !item.originalPosition) return;
        
        updateItem(itemId, {
            width: item.originalSize.width,
            height: item.originalSize.height,
            x: item.originalPosition.x,
            y: item.originalPosition.y,
            isMaximized: false,
            originalSize: undefined,
            originalPosition: undefined
        });
    }, [items, updateItem]);
    
    const handleDownloadImage = useCallback((itemId: string) => {
        const item = items.find(i => i.id === itemId);
        if (!item || !item.src) return;
        
        const link = document.createElement('a');
        link.href = item.src;
        link.download = `image-${item.id}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [items]);
    
    const handleRegenerateImage = useCallback((itemId: string) => {
        const item = items.find(i => i.id === itemId);
        if (!item || !item.aiEditHistory || item.aiEditHistory.length === 0) return;
        
        // Get the last edit prompt and regenerate
        const lastEdit = item.aiEditHistory[item.aiEditHistory.length - 1];
        
        // Mark as editing
        updateItem(itemId, { isAiEditing: true });
        
        // This would trigger the AI edit modal or directly call the AI service
        // For now, just log the action
        console.log('Regenerating image with prompt:', lastEdit.prompt);
    }, [items, updateItem]);

    const switchBoard = useCallback(async (boardId: string) => {
        setIsLoadingBoard(true);
        setItemsInitialized(false);
        hasLoadedFromServerRef.current = false;
        setSelectedItemIds(new Set());
        setContextMenu(null);
        setEditingItemId(null);
        setInteractiveItemId(null);

        try {
            const nextState = authToken ? await loadApiState(boardId) : await loadLocalBoardState(boardId);
            setInitialState(nextState);
            setCurrentBoardId(nextState.boardId);
            if (nextState.boardId) {
                localStorage.setItem(CURRENT_BOARD_STORAGE_KEY, nextState.boardId);
            }
        } catch (err) {
            console.error('Failed to switch board:', err);
        } finally {
            setIsLoadingBoard(false);
        }
    }, [authToken]);
    
    return {
        items,
        currentBoardId,
        isLoadingBoard,
        itemsInitialized,
        canvasBackgroundColor: backgroundColor,
        dotDensity,
        setCanvasBackgroundColor: setBackgroundColor,
        setDotDensity,
        switchBoard,
        selectedItemIds,
        panZoom,
        contextMenu,
        canvasRef,
        itemsContainerRef,
        editingItemId,
        interactiveItemId,
        generatingItems,
        generationModal,
        croppingItemId,
        selectionBox,
        handleAddItem,
        handleFileDrop,
        handleItemMouseDown,
        handleResizeMouseDown,
        handleRotationMouseDown,
        handleCanvasMouseDown,
        handleCanvasMouseMove,
        handleCanvasMouseUp,
        handleCanvasClick,
        handleCanvasContextMenu,
        closeContextMenu,
        handleDelete,
        handleAddVote,
        handleSendToBack,
        handleBringToFront,
        bringToFront,
        sendToBack,
        selectItemOnly,
        zoomBy,
        fitToScreen,
        handleItemDoubleClick,
        handleTextChange,
        clearBoard,
        changeTextColor,
        changeBackgroundColor,
        changeFontFamily,
        changeFontSize,
        handleExport,
        handleOpenGenerationModal,
        handleCloseGenerationModal,
        handleGenerateMedia,
        handleDownloadItem,
        handleStartCrop,
        handleCancelCrop,
        handleApplyCrop,
        updateItem,
        handleMaximizeImage,
        handleMinimizeImage,
        handleDownloadImage,
        handleRegenerateImage,
        // Undo/Redo functionality
        undo,
        redo,
        canUndo,
        canRedo,
        // High-quality export
        exportResolution,
        setExportResolution,
        exportHighQuality,
        // Panning/zooming state (for smooth animation)
        isPanning,
        isZooming,
        // Duplicate items
        duplicateItems,
        // Start/stop generating state (for AI editing spinner)
        startGenerating: (itemId: string) => setGeneratingItems(prev => new Set(prev).add(itemId)),
        stopGenerating: (itemId: string) => setGeneratingItems(prev => {
            const newSet = new Set(prev);
            newSet.delete(itemId);
            return newSet;
        }),
    };
};