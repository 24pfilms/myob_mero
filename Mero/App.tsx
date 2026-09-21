import React, { useState, useEffect } from 'react';
import { Toolbar } from './components/Toolbar';
import { Board } from './components/Board';
import { Footer } from './components/Footer';
import { ContextMenu } from './components/ContextMenu';
import { GenerationModal } from './components/GenerationModal';
import { AiAssistantModal } from './components/AiAssistantModal';
import { CroppingUI } from './components/CroppingUI';
import { YouTubeModal } from './components/YouTubeModal';
import { ObsidianVaultPanel } from './components/ObsidianVaultPanel';
import { BoardManager } from './components/BoardManager';
import { AiImageEditModal } from './components/AiImageEditModal';
import { ImageToVideoModal } from './components/ImageToVideoModal';
import { InlineMarkupPrompt } from './components/InlineMarkupPrompt';
import { MouseFollower } from './components/MouseFollower';
import { LoginModal } from './components/LoginModal';
import { BackgroundTest } from './components/BackgroundTest';
import { NoteFinderDrawer } from './components/NoteFinderDrawer';
import { JournalPanel } from './components/JournalPanel';
import { JournalSearchPanel } from './components/JournalSearchPanel';
import { RelatedNotesPanel } from './components/RelatedNotesPanel';
import { useBoard } from './hooks/useBoard';
import { useDatabase } from './hooks/useDatabase';
import { useVoiceCommands } from './hooks/useVoiceCommands';
import { XIcon } from './components/icons';
import { ItemType, BoardItem, ShapeType, DrawingTool, NoteCardData } from './types';
import { api, ApiUser } from './services/api';
import { myobApi, NoteSummary } from './services/myobApi';

interface PendingTool {
  type: ItemType;
  options?: Partial<BoardItem>;
}

const NoteEditorPanel = React.lazy(() => import('./components/NoteEditorPanel').then(module => ({ default: module.NoteEditorPanel })));

const TOOLBAR_POSITION_KEY = 'infinite-canvas-toolbar-position';

const noteCardData = (note: NoteSummary): NoteCardData => ({
  noteId: note.id,
  title: note.title || 'Untitled note',
  tags: note.tags || [],
  excerpt: note.excerpt || '',
  updatedAt: note.modified_at,
  embeddingState: note.embedding_status || 'missing',
  syncState: 'ready',
});

const parseYouTubeUrl = (url: string): string | null => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  if (match && match[2].length === 11) {
    return match[2];
  }
  return null;
};


function App() {
  // Initialize database FIRST
  const { isInitialized, isMigrating, error: dbError, retryInitialization } = useDatabase();

  const [authToken, setAuthToken] = useState<string | null>(() => api.getToken());
  const [authUser, setAuthUser] = useState<ApiUser | null>(() => api.getUser());
  
  // Only initialize useBoard after database is ready
  // Use a conditional hook wrapper to avoid calling useBoard before database is ready
  const boardData = useBoard({ authToken });
  
  // Extract board data
  const {
    currentBoardId,
    isLoadingBoard,
    itemsInitialized,
    canvasBackgroundColor,
    setCanvasBackgroundColor,
    dotDensity,
    setDotDensity,
    switchBoard,
    items,
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
    exportResolution,
    setExportResolution,
    undo,
    redo,
    canUndo,
    canRedo,
    selectItemOnly,
    isPanning,
    isZooming,
    duplicateItems,
    startGenerating,
    stopGenerating,
  } = boardData;

  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);
  const [isYouTubeModalOpen, setIsYouTubeModalOpen] = useState(false);
  const [isObsidianVaultOpen, setIsObsidianVaultOpen] = useState(false);
  const [isNoteFinderOpen, setIsNoteFinderOpen] = useState(false);
  const [isJournalOpen, setIsJournalOpen] = useState(false);
  const [isJournalSearchOpen, setIsJournalSearchOpen] = useState(false);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [isBoardManagerOpen, setIsBoardManagerOpen] = useState(false);
  const [aiImageEditItem, setAiImageEditItem] = useState<any>(null);
  const [imageToVideoItem, setImageToVideoItem] = useState<any>(null);
  const [inlineMarkupPrompt, setInlineMarkupPrompt] = useState<{ item: BoardItem; x: number; y: number } | null>(null);
  const [toolbarPosition, setToolbarPosition] = useState<'top' | 'left' | 'bottom' | 'right'>(() => {
    return (localStorage.getItem(TOOLBAR_POSITION_KEY) as 'top' | 'left' | 'bottom' | 'right') || 'top';
  });
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [pendingTool, setPendingTool] = useState<PendingTool | null>(null);
  const [drawingTool, setDrawingTool] = useState<DrawingTool>(null);
  const [isBackgroundTestOpen, setIsBackgroundTestOpen] = useState(false);
  
  // Voice commands integration
  const {
    isActive: voiceCommandsActive,
    isSupported: voiceSupported,
    status: voiceStatus,
    feedback: voiceFeedback,
    feedbackType: voiceFeedbackType,
    toggleVoiceCommands
  } = useVoiceCommands({
    mousePosition,
    onCreateItem: handleAddItem,
    canvasRef
  });
  
  // Debug pendingTool changes
  useEffect(() => {
    console.log('📌 pendingTool state changed to:', pendingTool);
  }, [pendingTool]);

  // Validate token on load
  useEffect(() => {
    const validate = async () => {
      if (!authToken) return;
      try {
        const me = await api.me();
        setAuthUser(me);
      } catch {
        api.logout();
        setAuthToken(null);
        setAuthUser(null);
      }
    };
    validate();
  }, [authToken]);

  const selectedItems = items.filter(item => selectedItemIds.has(item.id));
  const selectedNote = selectedItems.length === 1 && selectedItems[0].type === ItemType.NoteCard ? selectedItems[0].noteData : null;
  const itemToCrop = items.find(item => item.id === croppingItemId);

  const placeNote = (note: NoteSummary, x?: number, y?: number) => {
    handleAddItem(ItemType.NoteCard, { noteData: noteCardData(note) }, x, y, true);
  };

  const placeRelatedNote = async (noteId: string) => {
    const note = await myobApi.getNote(noteId);
    placeNote({ ...note, excerpt: note.excerpt || note.content.replace(/\s+/g, ' ').slice(0, 240), modified_at: note.updated_at || note.modified_at });
  };

  const refreshVisibleNoteCards = async (note: Awaited<ReturnType<typeof myobApi.getNote>>) => {
    const summary: NoteSummary = {
      ...note,
      excerpt: note.content.replace(/\s+/g, ' ').slice(0, 240),
      modified_at: note.updated_at || note.modified_at,
    };
    const data = noteCardData(summary);
    await Promise.all(items.filter(item => item.noteData?.noteId === note.id).map(item => updateItem(item.id, { noteData: data })));
  };

  const handleBoardItemDoubleClick = (itemId: string) => {
    const item = items.find(candidate => candidate.id === itemId);
    if (item?.type === ItemType.NoteCard && item.noteData) {
      setActiveNoteId(item.noteData.noteId);
      return;
    }
    handleItemDoubleClick(itemId);
  };
  
  // Tool selection - set up for click-to-place interaction
  const handleToolSelect = (type: ItemType, options?: Partial<BoardItem>) => {
    console.log('🎯 Tool selected:', type, options);
    setPendingTool({ type, options });
    // Close AI Assistant when selecting a tool to avoid z-index conflicts
    if (isAiAssistantOpen) {
      console.log('🚪 Closing AI Assistant to place item');
      setIsAiAssistantOpen(false);
    }
  };
  
  // Create item at specific canvas position
  const createItemAtPosition = (x: number, y: number) => {
    if (!pendingTool) return;
    handleAddItem(pendingTool.type, pendingTool.options, x, y);
    setPendingTool(null); // Clear tool selection after placing
  };
  
  // DOM-based precise placement system
  const handleCanvasClickWithToolPlacement = (e: React.MouseEvent<HTMLDivElement>) => {
    console.log('🖱️ Canvas clicked! Pending tool:', pendingTool);
    
    // If we have a pending tool, place it at the click position
    if (pendingTool && itemsContainerRef.current) {
      // Create a temporary DOM element at the exact click position to get precise coordinates
      const tempElement = document.createElement('div');
      tempElement.style.position = 'fixed';
      tempElement.style.left = e.clientX + 'px';
      tempElement.style.top = e.clientY + 'px';
      tempElement.style.width = '1px';
      tempElement.style.height = '1px';
      tempElement.style.pointerEvents = 'none';
      tempElement.style.visibility = 'hidden';
      document.body.appendChild(tempElement);
      
      // Get the position of this element relative to the itemsContainer
      const containerRect = itemsContainerRef.current.getBoundingClientRect();
      const elementRect = tempElement.getBoundingClientRect();
      
      // Calculate world coordinates directly from DOM positions
      const worldX = (elementRect.left - containerRect.left) / panZoom.k;
      const worldY = (elementRect.top - containerRect.top) / panZoom.k;
      
      console.log('=== DOM-BASED PLACEMENT ===');
      console.log('Mouse click (screen):', { clientX: e.clientX, clientY: e.clientY });
      console.log('Container rect:', containerRect);
      console.log('Temp element rect:', elementRect);
      console.log('World coordinates:', { x: worldX, y: worldY });
      
      // Clean up the temporary element
      document.body.removeChild(tempElement);
      
      // Place the item at the calculated world coordinates
      console.log('✨ Attempting to create item:', { type: pendingTool.type, options: pendingTool.options, x: worldX, y: worldY });
      handleAddItem(pendingTool.type, pendingTool.options, worldX, worldY, true);
      console.log('✅ Item creation called, clearing pending tool');
      
      setPendingTool(null);
      return;
    }
    
    // Otherwise, call the original canvas click handler
    handleCanvasClick(e);
  };
  
  useEffect(() => {
    document.body.style.backgroundColor = canvasBackgroundColor;
  }, [canvasBackgroundColor]);

  useEffect(() => {
    localStorage.setItem(TOOLBAR_POSITION_KEY, toolbarPosition);
  }, [toolbarPosition]);

  // Track mouse position for creating items at cursor location
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);
  
  // Fullscreen functionality
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        // Enter fullscreen
        await document.documentElement.requestFullscreen();
      } else {
        // Exit fullscreen
        await document.exitFullscreen();
      }
    } catch (error) {
      console.log('Fullscreen toggle failed:', error);
    }
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      
      // Escape key - cancel tool selection
      if (e.key === 'Escape' && pendingTool) {
        setPendingTool(null);
        return;
      }
      
      // Ctrl+Z - Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) {
          undo();
        }
        return;
      }
      
      // Ctrl+Y or Ctrl+Shift+Z - Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        if (canRedo) {
          redo();
        }
        return;
      }
      
      // Ctrl+D - Duplicate selected items
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        if (selectedItemIds.size > 0) {
          const newIds = duplicateItems(selectedItemIds, 20, 20);
          console.log('Duplicated items with Ctrl+D:', Array.from(newIds.entries()));
        }
        return;
      }
      
      // Ctrl+Alt+V - toggle voice commands
      if (e.ctrlKey && e.altKey && e.key === 'v') {
        e.preventDefault();
        console.log('🎤 Voice commands keyboard shortcut triggered');
        toggleVoiceCommands();
        return;
      }
      
      // F11 key - toggle fullscreen
      if (e.key === 'F11') {
        e.preventDefault(); // Prevent browser's default F11 behavior
        toggleFullscreen();
        return;
      }
      
      // Ctrl+Alt+B - toggle background test page
      if (e.ctrlKey && e.altKey && e.key === 'b') {
        e.preventDefault();
        console.log('🎨 Background test toggle triggered');
        setIsBackgroundTestOpen(prev => !prev);
        return;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingTool, toggleVoiceCommands, undo, redo, canUndo, canRedo, selectedItemIds, duplicateItems]);
  
  // Change cursor when tool is selected and add visual feedback
  useEffect(() => {
    if (pendingTool) {
      console.log('✏️ Pending tool active, cursor changed to crosshair:', pendingTool);
      // Set a more descriptive cursor for item placement
      document.body.style.cursor = 'crosshair';
      
      // Add a temporary CSS rule for enhanced cursor feedback
      const style = document.createElement('style');
      style.id = 'pending-tool-cursor';
      style.textContent = `
        .canvas-with-pending-tool {
          cursor: crosshair !important;
        }
        .canvas-with-pending-tool::after {
          content: '';
          position: fixed;
          pointer-events: none;
          width: 20px;
          height: 20px;
          border: 2px solid #3b82f6;
          border-radius: 50%;
          background: rgba(59, 130, 246, 0.2);
          z-index: 9999;
          transform: translate(-50%, -50%);
        }
      `;
      document.head.appendChild(style);
    } else {
      document.body.style.cursor = 'default';
      
      // Remove the temporary cursor style
      const existingStyle = document.getElementById('pending-tool-cursor');
      if (existingStyle) {
        document.head.removeChild(existingStyle);
      }
    }
    
    return () => {
      document.body.style.cursor = 'default';
      const existingStyle = document.getElementById('pending-tool-cursor');
      if (existingStyle) {
        document.head.removeChild(existingStyle);
      }
    };
  }, [pendingTool]);

  const handleAddAiResponseToBoard = (text: string) => {
    const lines = Math.ceil(text.length / 35); // Approximate characters per line for a 300px wide box.
    const calculatedHeight = Math.max(50, lines * 28 + 20); // (lines * line-height) + padding

    handleAddItem(ItemType.StickyNote, {
      text,
      width: 300,
      height: calculatedHeight,
      backgroundColor: '#FFFFFF',
      textColor: '#000000',
    });
    setIsAiAssistantOpen(false);
  };
  
  const handleAddYouTubeVideo = (url: string) => {
      const videoId = parseYouTubeUrl(url);
      if (videoId) {
          handleAddItem(ItemType.YouTubeVideo, { videoId });
          setIsYouTubeModalOpen(false);
      } else {
          alert("Invalid YouTube URL provided. Please check the link and try again.");
      }
  };
  
  const handleOpenAiImageEdit = (item: any) => {
    // If item has markup, show inline prompt instead of full modal
    if (item.drawingData && contextMenu) {
      setInlineMarkupPrompt({ item, x: contextMenu.x, y: contextMenu.y });
      closeContextMenu();
      return;
    }
    setAiImageEditItem(item);
  };
  
  const handleCloseAiImageEdit = () => {
    setAiImageEditItem(null);
  };
  
  const handleCloseInlineMarkupPrompt = () => {
    setInlineMarkupPrompt(null);
  };
  
  // Wrapper to prevent item dragging when drawing tool is active
  const handleItemMouseDownWithFreeze = (e: React.MouseEvent<HTMLDivElement>, itemId: string) => {
    // Ignore middle mouse button - allow panning without moving objects
    if (e.button === 1) return;
    
    if (drawingTool) {
      // When drawing tool is active, only allow selection (not dragging)
      e.stopPropagation();
      e.preventDefault();
      // Select the item if not already selected (without starting drag)
      if (!selectedItemIds.has(itemId)) {
        selectItemOnly(itemId);
      }
      return;
    }
    handleItemMouseDown(e, itemId);
  };
  
  const handleApplyAiImageEdit = (itemId: string, newImageUrl: string, prompt: string, originalUrl?: string, _newDimensions?: { width: number; height: number }) => {
    // Find the current item to preserve its existing AI edit history
    const currentItem = items.find(item => item.id === itemId);
    if (currentItem) {
      // Note: The image has already been resized in geminiService to match original dimensions,
      // so we don't need to resize the canvas item - it stays the same size
      const updateData: Partial<BoardItem> = {
        src: newImageUrl,
        originalImageUrl: originalUrl || currentItem.originalImageUrl || currentItem.src,
        aiEditHistory: [
          ...(currentItem.aiEditHistory || []),
          {
            prompt,
            resultUrl: newImageUrl,
            timestamp: Date.now()
          }
        ],
        isAiEditing: false,  // Mark as not editing anymore
        drawingData: undefined  // Clear markup in same update to avoid race condition
      };
      
      updateItem(itemId, updateData);
    }
    setAiImageEditItem(null);
  };
  
  const handleOpenImageToVideo = (item: any) => {
    setImageToVideoItem(item);
  };
  
  const handleCloseImageToVideo = () => {
    setImageToVideoItem(null);
  };
  
  const handleVideoGenerated = (itemId: string, videoUrl: string, prompt: string) => {
    // Add the generated video to the canvas as a new item or update the existing image
    // For now, let's create a new YouTube-like video item
    handleAddItem(ItemType.YouTubeVideo, {
      src: videoUrl,
      videoPrompt: prompt,
      text: `Generated from image: ${prompt}`
    });
    
    console.log('Video generated for item:', itemId, videoUrl);
  };
  
  // Handle canvas zoom with scroll wheel
  const handleCanvasWheel = (delta: number) => {
    console.log('🎡 App handleCanvasWheel - delta:', delta);
    zoomBy(1 + delta);
  };

  // Show database loading state
  if (isMigrating) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-lg">Initializing database...</p>
          <p className="text-gray-400 text-sm mt-2">This may take a moment on first launch</p>
        </div>
      </div>
    );
  }

  // Show database error state
  if (dbError) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center max-w-md p-6">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-white text-xl font-bold mb-2">Database Error</h2>
          <p className="text-gray-400 mb-6">{dbError}</p>
          <div className="space-y-2">
            <button
              onClick={retryInitialization}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Retry
            </button>
            <button
              onClick={() => {
                localStorage.clear();
                indexedDB.deleteDatabase('MeroCanvasDB');
                window.location.reload();
              }}
              className="w-full px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
            >
              Reset & Reload
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Don't render the main app until database is ready
  if (!isInitialized) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  // Handle login
  const handleLogin = (user: ApiUser) => {
    setAuthToken(api.getToken());
    setAuthUser(user);
  };

  const handleLogout = () => {
    api.logout();
    setAuthToken(null);
    setAuthUser(null);
  };

  // Show login modal if not logged in
  if (!authToken) {
    return (
      <div className="w-screen h-screen bg-gray-900">
        <LoginModal onLogin={handleLogin} />
      </div>
    );
  }

  // Show loading state while board data is being fetched after login
  if (isLoadingBoard || !itemsInitialized) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading your boards...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen font-sans">
      <Toolbar 
        onAddItem={handleToolSelect}
        selectedTool={pendingTool}
        onZoomIn={() => zoomBy(1.2)}
        onZoomOut={() => zoomBy(0.8)}
        onFitToScreen={fitToScreen}
        onClearBoard={clearBoard}
        onExport={handleExport}
        onOpenAiAssistant={() => setIsAiAssistantOpen(true)}
        onOpenYouTubeModal={() => setIsYouTubeModalOpen(true)}
        onOpenNotes={() => setIsNoteFinderOpen(true)}
        onOpenJournal={() => setIsJournalOpen(true)}
        onOpenJournalSearch={() => setIsJournalSearchOpen(true)}
        onOpenObsidianVault={() => setIsObsidianVaultOpen(true)}
        onOpenBoardManager={() => setIsBoardManagerOpen(true)}
        onBackgroundColorChange={setCanvasBackgroundColor}
        dotDensity={dotDensity}
        onDotDensityChange={setDotDensity}
        toolbarPosition={toolbarPosition}
        onToolbarPositionChange={setToolbarPosition}
        voiceCommandsActive={voiceCommandsActive}
        voiceCommandsSupported={voiceSupported}
        onToggleVoiceCommands={toggleVoiceCommands}
        exportResolution={exportResolution}
        onExportResolutionChange={setExportResolution}
        drawingTool={drawingTool}
        onDrawingToolChange={setDrawingTool}
      />

      {/* User menu / Logout button */}
      <div className="fixed top-3 right-3 z-[60]">
        <button
          onClick={handleLogout}
          className="group relative px-4 py-2 text-sm font-medium rounded-xl 
            bg-slate-900/80 backdrop-blur-md text-blue-300
            border border-blue-500/30
            transition-all duration-300 ease-out
            hover:border-blue-400/60
            hover:shadow-[0_0_20px_rgba(59,130,246,0.4),0_0_40px_rgba(59,130,246,0.2)]
            hover:text-blue-200"
          title={authUser ? `Logged in as ${authUser.username}` : 'Logout'}
        >
          {/* Subtle gradient overlay */}
          <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-600/10 via-cyan-500/10 to-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          
          {/* Content */}
          <span className="relative flex items-center gap-2">
            {authUser && (
              <span className="text-gray-400 group-hover:text-blue-300 transition-colors">
                {authUser.username}
              </span>
            )}
            <span className="text-blue-400 group-hover:text-blue-200 transition-colors">
              Logout
            </span>
          </span>
        </button>
      </div>
      <Board
        canvasRef={canvasRef}
        itemsContainerRef={itemsContainerRef}
        items={items}
        selectedItems={selectedItems}
        selectedItemIds={selectedItemIds}
        generatingItems={generatingItems}
        panZoom={panZoom}
        editingItemId={editingItemId}
        interactiveItemId={interactiveItemId}
        backgroundColor={canvasBackgroundColor}
        dotDensity={dotDensity}
        selectionBox={selectionBox}
        onCanvasMouseDown={handleCanvasMouseDown}
        onCanvasMouseMove={handleCanvasMouseMove}
        onCanvasMouseUp={handleCanvasMouseUp}
        onCanvasClick={handleCanvasClickWithToolPlacement}
        onCanvasContextMenu={handleCanvasContextMenu}
        onItemMouseDown={handleItemMouseDownWithFreeze}
        onItemDoubleClick={handleBoardItemDoubleClick}
        onTextChange={handleTextChange}
        // FIX: Corrected typo from onResizeMouseDown to handleResizeMouseDown.
        onResizeMouseDown={handleResizeMouseDown}
        // FIX: Corrected typo from onRotationMouseDown to handleRotationMouseDown.
        onRotationMouseDown={handleRotationMouseDown}
        onFileDrop={handleFileDrop}
        onNoteDrop={placeNote}
        onWheel={handleCanvasWheel}
        onChangeTextColor={changeTextColor}
        onChangeBackgroundColor={changeBackgroundColor}
        onChangeFontFamily={changeFontFamily}
        onChangeFontSize={changeFontSize}
        onBringToFront={() => bringToFront(selectedItemIds)}
        onSendToBack={() => sendToBack(selectedItemIds)}
        onOpenGenerationModal={handleOpenGenerationModal}
        onDownload={handleDownloadItem}
        onStartCrop={handleStartCrop}
        onOpenAiImageEdit={handleOpenAiImageEdit}
        onOpenImageToVideo={handleOpenImageToVideo}
        onMaximizeImage={handleMaximizeImage}
        onMinimizeImage={handleMinimizeImage}
        onRegenerateImage={handleRegenerateImage}
        onDownloadImage={handleDownloadImage}
        drawingTool={drawingTool}
        onUpdateItemDrawing={(itemId, drawingData) => updateItem(itemId, { drawingData })}
        isPanning={isPanning}
        isZooming={isZooming}
        useInteractiveBackground={true}
      />
      {activeNoteId && (
        <React.Suspense fallback={<div className="fixed inset-x-4 bottom-4 z-[80] rounded-xl border border-gray-600 bg-gray-950 p-6 text-gray-300" role="status">Loading note editor...</div>}>
          <NoteEditorPanel
            noteId={activeNoteId}
            onClose={() => { setActiveNoteId(null); window.setTimeout(() => document.querySelector<HTMLButtonElement>('button[aria-label="Notes"]')?.focus(), 0); }}
            onSaved={refreshVisibleNoteCards}
          />
        </React.Suspense>
      )}
      {isNoteFinderOpen && (
        <NoteFinderDrawer
          onClose={() => setIsNoteFinderOpen(false)}
          onPlace={placeNote}
          onOpen={note => { setActiveNoteId(note.id); setIsNoteFinderOpen(false); }}
        />
      )}
      {isJournalOpen && (
        <JournalPanel
          onClose={() => setIsJournalOpen(false)}
          onOpen={note => { setActiveNoteId(note.id); setIsJournalOpen(false); }}
        />
      )}
      {isJournalSearchOpen && (
        <JournalSearchPanel
          onClose={() => setIsJournalSearchOpen(false)}
          onOpen={note => { setActiveNoteId(note.id); setIsJournalSearchOpen(false); }}
        />
      )}
      {selectedNote && !isNoteFinderOpen && !isJournalOpen && !isJournalSearchOpen && <RelatedNotesPanel noteId={selectedNote.noteId} onPlace={placeRelatedNote} />}
      {contextMenu && (
        <ContextMenu
          data={contextMenu}
          items={items}
          onClose={closeContextMenu}
          onDelete={handleDelete}
          onAddVote={handleAddVote}
          onBringToFront={handleBringToFront}
          onSendToBack={handleSendToBack}
          onOpenAiImageEdit={handleOpenAiImageEdit}
          onOpenImageToVideo={handleOpenImageToVideo}
          onMaximizeImage={handleMaximizeImage}
          onMinimizeImage={handleMinimizeImage}
          onDownloadImage={handleDownloadImage}
          onRegenerateImage={handleRegenerateImage}
        />
      )}
      {generationModal.itemId && (
        <GenerationModal
            itemId={generationModal.itemId}
            onClose={handleCloseGenerationModal}
            onGenerate={handleGenerateMedia}
        />
      )}
      {itemToCrop && (
        <CroppingUI
            item={itemToCrop}
            onApply={handleApplyCrop}
            onCancel={handleCancelCrop}
        />
      )}
      {isAiAssistantOpen && (
        <AiAssistantModal
          isOpen={isAiAssistantOpen}
          onClose={() => setIsAiAssistantOpen(false)}
          onAddToBoard={handleAddAiResponseToBoard}
          selectedNoteId={selectedNote?.noteId}
        />
      )}
      {isYouTubeModalOpen && (
        <YouTubeModal
          onClose={() => setIsYouTubeModalOpen(false)}
          onAdd={handleAddYouTubeVideo}
        />
      )}
      {isObsidianVaultOpen && (
        <ObsidianVaultPanel
          onAddItem={handleAddItem}
          isOpen={isObsidianVaultOpen}
          onClose={() => setIsObsidianVaultOpen(false)}
        />
      )}
      {isBoardManagerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Electric backdrop */}
          <div className="absolute inset-0 bg-slate-950/95" onClick={() => setIsBoardManagerOpen(false)}>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-600/20 via-transparent to-transparent" />
          </div>
          
          {/* Modal */}
          <div className="relative w-full max-w-3xl mx-4">
            {/* Electric glow */}
            <div className="absolute -inset-2 bg-blue-500/20 rounded-3xl blur-xl animate-pulse" />
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 rounded-2xl opacity-60" />
            
            {/* Glass card */}
            <div className="relative bg-slate-900/90 backdrop-blur-xl rounded-2xl overflow-hidden">
              {/* Animated top bar */}
              <div className="h-1 bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-600 animate-pulse" />
              
              {/* Close button */}
              <button
                onClick={() => setIsBoardManagerOpen(false)}
                className="absolute top-4 right-4 z-10 p-2 rounded-lg text-gray-400 hover:text-white hover:bg-blue-500/20 transition-colors"
              >
                <XIcon />
              </button>
              <BoardManager 
                onSwitchBoard={(boardId) => {
                  console.log('Switching to board:', boardId);
                  setIsBoardManagerOpen(false);
                  switchBoard(boardId);
                }}
                onClose={() => setIsBoardManagerOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
      {aiImageEditItem && (
        <AiImageEditModal
          isOpen={!!aiImageEditItem}
          item={aiImageEditItem}
          onClose={handleCloseAiImageEdit}
          onApply={handleApplyAiImageEdit}
          onClearDrawing={(itemId) => updateItem(itemId, { drawingData: undefined })}
          onStartEditing={startGenerating}
          onStopEditing={stopGenerating}
        />
      )}
      {imageToVideoItem && (
        <ImageToVideoModal
          isOpen={!!imageToVideoItem}
          item={imageToVideoItem}
          onClose={handleCloseImageToVideo}
          onVideoGenerated={handleVideoGenerated}
        />
      )}
      {inlineMarkupPrompt && (
        <InlineMarkupPrompt
          item={inlineMarkupPrompt.item}
          x={inlineMarkupPrompt.x}
          y={inlineMarkupPrompt.y}
          onClose={handleCloseInlineMarkupPrompt}
          onApply={handleApplyAiImageEdit}
          onClearDrawing={(itemId) => updateItem(itemId, { drawingData: undefined })}
          onStartEditing={startGenerating}
          onStopEditing={stopGenerating}
        />
      )}
      <MouseFollower pendingTool={pendingTool} canvasRef={canvasRef} />
      
      {/* Voice command feedback notification */}
      {voiceFeedback && (
        <div className={`fixed top-20 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg z-50 ${
          voiceFeedbackType === 'success' ? 'bg-green-500 text-white' :
          voiceFeedbackType === 'error' ? 'bg-red-500 text-white' :
          'bg-blue-500 text-white'
        }`}>
          <div className="flex items-center gap-2">
            {voiceFeedbackType === 'success' && <span>✓</span>}
            {voiceFeedbackType === 'error' && <span>✗</span>}
            {voiceFeedbackType === 'info' && <span>🎤</span>}
            <span>{voiceFeedback}</span>
          </div>
        </div>
      )}
      
      {/* Background Test Page - Ctrl+Alt+B to toggle */}
      {isBackgroundTestOpen && (
        <BackgroundTest onClose={() => setIsBackgroundTestOpen(false)} />
      )}
      
      <Footer />
    </div>
  );
}

export default App;
