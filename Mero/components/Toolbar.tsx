import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ItemType, ShapeType, BoardItem } from '../types';
import { StickyNoteIcon, SquareIcon, TextIcon, FrameIcon, ZoomInIcon, ZoomOutIcon, FitToScreenIcon, TrashIcon, ExportIcon, ShapesIcon, RoundedRectangleIcon, CircleIcon, TriangleIcon, DiamondIcon, HexagonIcon, BotIcon, PaletteIcon, GridIcon, MousePointerIcon, LineIcon, ArrowRightIcon, ArrowLeftIcon, ArrowUpIcon, ArrowDownIcon, ArrowBothIcon, LayoutHorizontalIcon, LayoutVerticalIcon, YouTubeIcon, FolderOpen, JournalIcon, MoveIcon, BoardIcon, MicrophoneIcon, PenToolIcon, EraserIcon } from './icons';
import { DrawingTool } from '../types';

interface PendingTool {
  type: ItemType;
  options?: Partial<BoardItem>;
}

type ExportResolution = '1K' | '2K' | '4K' | 'Original';

interface ToolbarProps {
  onAddItem: (type: ItemType, options?: Partial<BoardItem>) => void;
  selectedTool: PendingTool | null;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToScreen: () => void;
  onClearBoard: () => void;
  onExport: (format: 'PNG' | 'JPG' | 'PDF' | 'CSV') => void;
  onOpenAiAssistant: () => void;
  onOpenYouTubeModal: () => void;
  onOpenNotes: () => void;
  onOpenJournal: () => void;
  onOpenObsidianVault: () => void;
  onOpenBoardManager: () => void;
  onBackgroundColorChange: (color: string) => void;
  dotDensity: number;
  onDotDensityChange: (density: number) => void;
  toolbarPosition: 'top' | 'left' | 'bottom' | 'right';
  onToolbarPositionChange: React.Dispatch<React.SetStateAction<'top' | 'left' | 'bottom' | 'right'>>;
  voiceCommandsActive?: boolean;
  voiceCommandsSupported?: boolean;
  onToggleVoiceCommands?: () => void;
  exportResolution?: ExportResolution;
  onExportResolutionChange?: (resolution: ExportResolution) => void;
  // Drawing tools
  drawingTool?: DrawingTool;
  onDrawingToolChange?: (tool: DrawingTool) => void;
}

/* GLASSMORPHISM TOOLBUTTON - To revert, use: bg-blue-900/50 for active, hover:bg-gray-700 for inactive */
const ToolButton = ({ children, onClick, active = false, tooltip }: { children: React.ReactNode; onClick?: () => void; active?: boolean; tooltip: string }) => (
    <div className="relative group overflow-visible">
        <button
            aria-label={tooltip}
            onClick={(e) => {
                console.log('🔘 ToolButton clicked!', { hasOnClick: !!onClick });
                e.stopPropagation();
                if (onClick) {
                    console.log('🔘 Calling onClick handler');
                    onClick();
                }
            }}
            className={`p-2 rounded-lg transition-all duration-200 ${
                active 
                    ? 'bg-blue-500/25 text-blue-300 shadow-[0_0_11px_rgba(59,130,246,0.4),0_0_22px_rgba(59,130,246,0.15)]' 
                    : 'hover:bg-blue-500/15 hover:text-blue-300 hover:shadow-[0_0_9px_rgba(59,130,246,0.3),0_0_19px_rgba(59,130,246,0.1)]'
            }`}
        >
            {children}
        </button>
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-max max-w-xs px-3 py-1.5 
            bg-slate-900/90 backdrop-blur-md text-blue-100 text-xs rounded-lg 
            opacity-0 group-hover:opacity-100 transition-opacity duration-200 
            pointer-events-none z-[9999] 
            shadow-[0_4px_20px_rgba(0,0,0,0.3)] border border-blue-500/20">
            {tooltip}
        </div>
    </div>
);

const ShapeMenuItem = ({ children, onClick, tooltip }: { children: React.ReactNode; onClick: () => void; tooltip: string }) => (
     <div className="relative group overflow-visible">
        <button
            aria-label={tooltip}
            onClick={(e) => {
                console.log('🔶 ShapeMenuItem clicked!');
                e.stopPropagation();
                onClick();
            }}
            className="p-2 rounded-md hover:bg-gray-700 w-full flex justify-center"
        >
            {children}
        </button>
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 w-max px-3 py-1.5 bg-gray-900 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-[9999] shadow-lg border border-gray-700">
            {tooltip}
        </div>
    </div>
);

export const Toolbar: React.FC<ToolbarProps> = ({ onAddItem, selectedTool, onZoomIn, onZoomOut, onFitToScreen, onClearBoard, onExport, onOpenAiAssistant, onOpenYouTubeModal, onOpenNotes, onOpenJournal, onOpenObsidianVault, onOpenBoardManager, onBackgroundColorChange, dotDensity, onDotDensityChange, toolbarPosition, onToolbarPositionChange, voiceCommandsActive = false, voiceCommandsSupported = true, onToggleVoiceCommands, exportResolution = '2K', onExportResolutionChange, drawingTool = null, onDrawingToolChange }) => {
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isShapeMenuOpen, setIsShapeMenuOpen] = useState(false);
  const [isDensityMenuOpen, setIsDensityMenuOpen] = useState(false);
  
  useEffect(() => {
    console.log('📋 isShapeMenuOpen state:', isShapeMenuOpen);
  }, [isShapeMenuOpen]);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const shapeMenuRef = useRef<HTMLDivElement>(null);
  const densityMenuRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
      // For shape menu, also check if click is on the portaled dropdown
      const isShapeDropdownClick = (event.target as Element).closest('[data-toolbar-dropdown="true"]');
      if (shapeMenuRef.current && !shapeMenuRef.current.contains(event.target as Node) && !isShapeDropdownClick) {
        setIsShapeMenuOpen(false);
      }
      if (densityMenuRef.current && !densityMenuRef.current.contains(event.target as Node)) {
        setIsDensityMenuOpen(false);
      }
    };
    
    // CRITICAL: Block wheel events on toolbar to prevent scaling
    const blockToolbarWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    
    // Block wheel events directly on the toolbar element
    if (toolbarRef.current) {
      toolbarRef.current.addEventListener('wheel', blockToolbarWheel, { passive: false, capture: true });
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (toolbarRef.current) {
        toolbarRef.current.removeEventListener('wheel', blockToolbarWheel, { capture: true });
      }
    };
  }, []);
    
  const handleExportClick = (format: 'PNG' | 'JPG' | 'PDF' | 'CSV') => {
    onExport(format);
    setIsExportMenuOpen(false);
  };

  const handleShapeClick = (shapeType: ShapeType) => {
    console.log('🔧 Toolbar: Shape button clicked:', shapeType);
    const isLineOrArrow = [ShapeType.Line, ShapeType.ArrowUp, ShapeType.ArrowRight, ShapeType.ArrowDown, ShapeType.ArrowLeft, ShapeType.ArrowBoth].includes(shapeType);
    const options: Partial<BoardItem> = {
        shape: shapeType,
        backgroundColor: isLineOrArrow ? '#FFFFFF' : '#e0e0e0',
        textColor: '#000000',
    };
    if (isLineOrArrow) {
        options.height = 10;
        options.text = '';
    }
    console.log('🔧 Toolbar: Calling onAddItem with:', ItemType.Shape, options);
    onAddItem(ItemType.Shape, options);
    setIsShapeMenuOpen(false);
  }
  
  const getNextPosition = () => {
    switch (toolbarPosition) {
      case 'top': return 'Left';
      case 'left': return 'Bottom';
      case 'bottom': return 'Right';
      case 'right': return 'Top';
      default: return 'Left';
    }
  };
  
  const handleTogglePosition = () => {
    onToolbarPositionChange(prev => {
      switch (prev) {
        case 'top': return 'left';
        case 'left': return 'bottom';
        case 'bottom': return 'right';
        case 'right': return 'top';
        default: return 'top';
      }
    });
  };

  const isHorizontal = toolbarPosition === 'top' || toolbarPosition === 'bottom';

  const getContainerPositionClass = () => {
    switch (toolbarPosition) {
      case 'top': return "top-4 left-1/2 -translate-x-1/2";
      case 'left': return "left-4 top-1/2 -translate-y-1/2";
      case 'bottom': return "bottom-4 left-1/2 -translate-x-1/2";
      case 'right': return "right-4 top-1/2 -translate-y-1/2";
      default: return "top-4 left-1/2 -translate-x-1/2";
    }
  };
  
  const contentLayoutClass = isHorizontal ? "flex-row" : "flex-col";
  
  const getMenuPositionClass = () => {
    switch (toolbarPosition) {
      case 'top': return "left-1/2 -translate-x-1/2 top-full mt-2";
      case 'left': return "left-full ml-2 top-1/2 -translate-y-1/2";
      case 'bottom': return "left-1/2 -translate-x-1/2 bottom-full mb-2";
      case 'right': return "right-full mr-2 top-1/2 -translate-y-1/2";
      default: return "left-1/2 -translate-x-1/2 top-full mt-2";
    }
  };
  
  const getExportMenuPositionClass = () => {
    switch (toolbarPosition) {
      case 'top': return "right-0 top-full mt-2";
      case 'left': return "left-full ml-2 top-1/2 -translate-y-1/2";
      case 'bottom': return "right-0 bottom-full mb-2";
      case 'right': return "right-full mr-2 top-1/2 -translate-y-1/2";
      default: return "right-0 top-full mt-2";
    }
  };
  
  const containerPositionClass = getContainerPositionClass();
  const menuPositionClass = getMenuPositionClass();

  const Divider = () => {
    const className = isHorizontal
        ? "w-px h-6 bg-gray-600 mx-2"
        : "w-6 h-px bg-gray-600 my-2";
    return <div className={className}></div>;
  };

  const toolbarContent = (
    <div 
      ref={toolbarRef}
      className={`fixed ${containerPositionClass}`} 
      data-toolbar="true"
      onClick={(e) => {
        console.log('🚨 TOOLBAR CONTAINER CLICKED', e.target);
      }}
      style={{ 
        transform: 'none !important', 
        position: 'fixed !important', 
        willChange: 'auto',
        zoom: '1 !important',
        scale: '1 !important',
        transformOrigin: 'initial !important',
        pointerEvents: 'auto',
        zIndex: 9999
      }}
    >
      {/* GLASSMORPHISM TOOLBAR - To revert, replace with: bg-gray-800 rounded-lg shadow-lg */}
      <div className={`flex items-center gap-1 p-1.5 
        bg-slate-900/70 backdrop-blur-xl rounded-xl 
        border border-blue-500/25
        shadow-[0_4px_30px_rgba(0,0,0,0.4),0_0_22px_rgba(59,130,246,0.19),0_0_45px_rgba(59,130,246,0.08)]
        text-gray-200 overflow-visible ${contentLayoutClass}`}>
        <ToolButton onClick={() => {}} active={selectedTool === null} tooltip="Select (V)">
            <MousePointerIcon />
        </ToolButton>
        <Divider />
        <ToolButton 
          onClick={() => {
            console.log('🔧 Toolbar: StickyNote button clicked');
            onAddItem(ItemType.StickyNote);
          }} 
          active={selectedTool?.type === ItemType.StickyNote}
          tooltip={selectedTool?.type === ItemType.StickyNote ? "Click on canvas to place" : "Sticky Note (N)"}
        >
            <StickyNoteIcon />
        </ToolButton>
        
        <div className="relative" ref={shapeMenuRef}>
            <ToolButton 
              onClick={() => {
                // Toggle menu to show all shape options
                console.log('🔧 Toolbar: Shapes button clicked - current state:', isShapeMenuOpen);
                const newState = !isShapeMenuOpen;
                console.log('🔧 Toolbar: Setting isShapeMenuOpen to:', newState);
                setIsShapeMenuOpen(newState);
              }}
              active={selectedTool?.type === ItemType.Shape || isShapeMenuOpen}
              tooltip="Shapes (S) - Click to see all shapes"
            >
                <ShapesIcon />
            </ToolButton>
            {isShapeMenuOpen && (() => {
              console.log('🟢 SHAPE MENU IS RENDERING NOW!');
              
              // Get button position for absolute positioning
              const buttonRect = shapeMenuRef.current?.getBoundingClientRect();
              
              return createPortal(
                 <div 
                   className="grid grid-cols-3 gap-1 p-2 w-max bg-slate-900/90 backdrop-blur-md border border-blue-500/20 rounded-xl shadow-[0_4px_30px_rgba(0,0,0,0.4),0_0_15px_rgba(59,130,246,0.1)]" 
                   data-toolbar-dropdown="true" 
                   style={{ 
                     position: 'fixed',
                     top: buttonRect ? `${buttonRect.bottom + 8}px` : '80px',
                     left: buttonRect ? `${buttonRect.left}px` : '50%',
                     zIndex: 99999,
                     pointerEvents: 'auto'
                   }}>
                    <ShapeMenuItem onClick={() => handleShapeClick(ShapeType.Rectangle)} tooltip="Rectangle">
                        <SquareIcon />
                    </ShapeMenuItem>
                    <ShapeMenuItem onClick={() => handleShapeClick(ShapeType.RoundedRectangle)} tooltip="Rounded Rectangle">
                        <RoundedRectangleIcon />
                    </ShapeMenuItem>
                    <ShapeMenuItem onClick={() => handleShapeClick(ShapeType.Circle)} tooltip="Circle">
                        <CircleIcon />
                    </ShapeMenuItem>
                    <ShapeMenuItem onClick={() => handleShapeClick(ShapeType.Triangle)} tooltip="Triangle">
                        <TriangleIcon />
                    </ShapeMenuItem>
                    <ShapeMenuItem onClick={() => handleShapeClick(ShapeType.Diamond)} tooltip="Diamond">
                        <DiamondIcon />
                    </ShapeMenuItem>
                    <ShapeMenuItem onClick={() => handleShapeClick(ShapeType.Hexagon)} tooltip="Hexagon">
                        <HexagonIcon />
                    </ShapeMenuItem>
                    <div className="col-span-3 h-px bg-gray-700 my-1"></div>
                     <ShapeMenuItem onClick={() => handleShapeClick(ShapeType.Line)} tooltip="Line">
                        <LineIcon />
                    </ShapeMenuItem>
                     <ShapeMenuItem onClick={() => handleShapeClick(ShapeType.ArrowRight)} tooltip="Arrow">
                        <ArrowRightIcon />
                    </ShapeMenuItem>
                     <ShapeMenuItem onClick={() => handleShapeClick(ShapeType.ArrowBoth)} tooltip="Double Arrow">
                        <ArrowBothIcon />
                    </ShapeMenuItem>
                </div>,
                document.body
              );
            })()}
        </div>
        
         <ToolButton 
           onClick={() => {
             console.log('🔧 Toolbar: TextBox button clicked');
             onAddItem(ItemType.TextBox);
           }} 
           active={selectedTool?.type === ItemType.TextBox}
           tooltip={selectedTool?.type === ItemType.TextBox ? "Click on canvas to place" : "Text (T)"}
         >
            <TextIcon />
        </ToolButton>
         <ToolButton 
           onClick={() => {
             console.log('🔧 Toolbar: Frame button clicked');
             onAddItem(ItemType.Frame);
           }} 
           active={selectedTool?.type === ItemType.Frame}
           tooltip={selectedTool?.type === ItemType.Frame ? "Click on canvas to place" : "Frame (F)"}
         >
            <FrameIcon />
        </ToolButton>
        
        <Divider />
        
        {/* Drawing Tools Section */}
        <ToolButton 
          onClick={() => {
            console.log('🔧 Toolbar: Pen tool clicked');
            onDrawingToolChange?.(drawingTool === 'pen' ? null : 'pen');
          }} 
          active={drawingTool === 'pen'}
          tooltip={drawingTool === 'pen' ? "Pen Active - Click item to draw" : "Pen Tool (P)"}
        >
          <PenToolIcon />
        </ToolButton>
        <ToolButton 
          onClick={() => {
            console.log('🔧 Toolbar: Eraser tool clicked');
            onDrawingToolChange?.(drawingTool === 'eraser' ? null : 'eraser');
          }} 
          active={drawingTool === 'eraser'}
          tooltip={drawingTool === 'eraser' ? "Eraser Active - Click item to erase" : "Eraser Tool (E)"}
        >
          <EraserIcon />
        </ToolButton>
        
        <Divider />
        
        <ToolButton onClick={onOpenYouTubeModal} tooltip="YouTube Video">
            <YouTubeIcon />
        </ToolButton>
        
        <ToolButton onClick={onOpenNotes} tooltip="Notes">
            <FolderOpen />
        </ToolButton>

        <ToolButton onClick={onOpenJournal} tooltip="Journal">
            <JournalIcon />
        </ToolButton>

        {/* Hidden for now
        <ToolButton onClick={onOpenObsidianVault} tooltip="Obsidian Vault">
            <FolderOpen />
        </ToolButton>
        */}
        
        <ToolButton onClick={onOpenBoardManager} tooltip="Board Manager">
            <BoardIcon />
        </ToolButton>
        
        <ToolButton onClick={onOpenAiAssistant} tooltip="AI Assistant">
            <BotIcon />
        </ToolButton>
        
        {voiceCommandsSupported && onToggleVoiceCommands && (
          <ToolButton 
            onClick={onToggleVoiceCommands} 
            active={voiceCommandsActive}
            tooltip={voiceCommandsActive ? "Voice Commands Active (Ctrl+Alt+V)" : "Enable Voice Commands (Ctrl+Alt+V)"}
          >
            <MicrophoneIcon />
            {voiceCommandsActive && (
              <div className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            )}
          </ToolButton>
        )}
        
        <Divider />

        <div className="relative group">
            <button
                onClick={() => colorInputRef.current?.click()}
                className={'p-2 rounded-md hover:bg-gray-700'}
            >
                <PaletteIcon />
                <input
                    ref={colorInputRef}
                    type="color"
                    onChange={(e) => onBackgroundColorChange(e.target.value)}
                    className="absolute w-0 h-0 opacity-0"
                />
            </button>
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-max px-2 py-1 bg-gray-900 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                Background Color
            </div>
        </div>

        <div className="relative" ref={densityMenuRef}>
          <ToolButton onClick={() => setIsDensityMenuOpen(prev => !prev)} tooltip="Grid Density">
            <GridIcon />
          </ToolButton>
          {isDensityMenuOpen && (
            <div className={`absolute ${menuPositionClass} p-2 w-40 bg-slate-900/90 backdrop-blur-md border border-blue-500/20 rounded-xl shadow-[0_4px_30px_rgba(0,0,0,0.4),0_0_15px_rgba(59,130,246,0.1)]`} data-toolbar-dropdown="true" style={{ transform: 'none' }}>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={dotDensity}
                onChange={(e) => onDotDensityChange(Number(e.target.value))}
                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          )}
        </div>
        
        <Divider />

        <ToolButton onClick={onZoomIn} tooltip="Zoom In">
            <ZoomInIcon />
        </ToolButton>
        <ToolButton onClick={onZoomOut} tooltip="Zoom Out">
            <ZoomOutIcon />
        </ToolButton>
        <ToolButton onClick={onFitToScreen} tooltip="Fit to screen">
            <FitToScreenIcon />
        </ToolButton>
        
        <Divider />

        <ToolButton onClick={onClearBoard} tooltip="Clear Board">
            <TrashIcon />
        </ToolButton>
        
        <div className="relative" ref={exportMenuRef}>
            <ToolButton onClick={() => setIsExportMenuOpen(prev => !prev)} tooltip="Export">
                <ExportIcon />
            </ToolButton>
            {isExportMenuOpen && (
                <div className={`absolute ${getExportMenuPositionClass()} w-48 bg-slate-900/90 backdrop-blur-md border border-blue-500/20 rounded-xl shadow-[0_4px_30px_rgba(0,0,0,0.4),0_0_15px_rgba(59,130,246,0.1)] py-1`} data-toolbar-dropdown="true" style={{ transform: 'none' }}>
                    {/* Resolution Selector */}
                    <div className="px-3 py-2 border-b border-blue-500/20">
                        <div className="text-xs text-gray-400 mb-1">Export Resolution</div>
                        <div className="flex gap-1">
                            {(['1K', '2K', '4K'] as const).map(res => (
                                <button
                                    key={res}
                                    onClick={() => onExportResolutionChange?.(res)}
                                    className={`flex-1 px-2 py-1 text-xs rounded ${
                                        exportResolution === res
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                    }`}
                                >
                                    {res}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button onClick={() => handleExportClick('PNG')} className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-blue-500/20 hover:text-blue-200 transition-colors rounded-lg mx-1" style={{width: 'calc(100% - 8px)'}}>
                        Export as PNG <span className="text-xs text-blue-400/60">({exportResolution})</span>
                    </button>
                    <button onClick={() => handleExportClick('JPG')} className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-blue-500/20 hover:text-blue-200 transition-colors rounded-lg mx-1" style={{width: 'calc(100% - 8px)'}}>
                        Export as JPG <span className="text-xs text-blue-400/60">({exportResolution})</span>
                    </button>
                    <button onClick={() => handleExportClick('PDF')} className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-blue-500/20 hover:text-blue-200 transition-colors rounded-lg mx-1" style={{width: 'calc(100% - 8px)'}}>Export as PDF</button>
                    <button onClick={() => handleExportClick('CSV')} className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-blue-500/20 hover:text-blue-200 transition-colors rounded-lg mx-1" style={{width: 'calc(100% - 8px)'}}>Export as CSV</button>
                </div>
            )}
        </div>
        <Divider />
         <ToolButton onClick={handleTogglePosition} tooltip={`Move Toolbar (${toolbarPosition.charAt(0).toUpperCase() + toolbarPosition.slice(1)} → ${getNextPosition()})`}>
          <MoveIcon />
        </ToolButton>
      </div>
    </div>
  );
  
  // Render toolbar using portal to ensure it's outside any transform context
  return createPortal(toolbarContent, document.body);
};
