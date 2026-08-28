import React, { RefObject } from 'react';
import { PanZoom, BoardItem, ItemType, DrawingTool } from '../types';
import { BoardItemComponent } from './BoardItemComponent';
import { ContextualToolbar } from './ContextualToolbar';
import { InteractiveBGPattern } from './ui/InteractiveBGPattern';
import { NOTE_DRAG_TYPE, NoteSummary } from '../services/myobApi';
import { RelationshipLayer } from './RelationshipLayer';

interface BoardProps {
  canvasRef: RefObject<HTMLDivElement>;
  itemsContainerRef: RefObject<HTMLDivElement>;
  items: BoardItem[];
  selectedItems: BoardItem[];
  selectedItemIds: Set<string>;
  generatingItems: Set<string>;
  panZoom: PanZoom;
  editingItemId: string | null;
  interactiveItemId: string | null;
  backgroundColor: string;
  dotDensity: number;
  selectionBox: { x: number; y: number; width: number; height: number } | null;
  onCanvasMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  onCanvasMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
  onCanvasMouseUp: (e: React.MouseEvent<HTMLDivElement>) => void;
  onCanvasClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  onCanvasContextMenu: (e: React.MouseEvent<HTMLDivElement>) => void;
  onItemMouseDown: (e: React.MouseEvent<HTMLDivElement>, itemId: string) => void;
  onItemDoubleClick: (itemId: string) => void;
  onTextChange: (itemId: string, newText: string) => void;
  onResizeMouseDown: (e: React.MouseEvent, itemId: string, handle: string) => void;
  onRotationMouseDown: (e: React.MouseEvent, itemId: string) => void;
  onFileDrop: (files: FileList, x: number, y: number) => void;
  onNoteDrop: (note: NoteSummary, x: number, y: number) => void;
  onWheel: (delta: number) => void;
  // Props for ContextualToolbar
  onChangeTextColor: (color: string) => void;
  onChangeBackgroundColor: (color: string) => void;
  onChangeFontFamily: (font: string) => void;
  onChangeFontSize: (delta: number) => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onOpenGenerationModal: (itemId: string) => void;
  onDownload: (itemId: string) => void;
  onStartCrop: (itemId: string) => void;
  // New image features
  onOpenAiImageEdit?: (item: BoardItem) => void;
  onOpenImageToVideo?: (item: BoardItem) => void;
  onMaximizeImage?: (itemId: string) => void;
  onMinimizeImage?: (itemId: string) => void;
  onChangeAspectRatio?: (itemId: string, ratio: string) => void;
  onRegenerateImage?: (itemId: string) => void;
  onDownloadImage?: (itemId: string) => void;
  // Drawing tools
  drawingTool?: DrawingTool;
  onUpdateItemDrawing?: (itemId: string, drawingData: string | undefined) => void;
  // Smooth panning/zooming
  isPanning?: boolean;
  isZooming?: boolean;
  // Interactive background
  useInteractiveBackground?: boolean;
}

// Helper function to determine contrast color for the grid
const getContrastingDotColor = (hex: string): string => {
  if (!hex) return 'rgba(255, 255, 255, 0.2)'; // Default for dark
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Using the luminance formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.2)';
};

export const Board: React.FC<BoardProps> = (
    {
        canvasRef,
        itemsContainerRef,
        items,
        selectedItems,
        selectedItemIds,
        generatingItems,
        panZoom,
        editingItemId,
        interactiveItemId,
        backgroundColor,
        dotDensity,
        selectionBox,
        onCanvasMouseDown,
        onCanvasMouseMove,
        onCanvasMouseUp,
        onCanvasClick,
        onCanvasContextMenu,
        onItemMouseDown,
        onItemDoubleClick,
        onTextChange,
        onResizeMouseDown,
        onRotationMouseDown,
        onFileDrop,
        onNoteDrop,
        onWheel,
        onChangeTextColor,
        onChangeBackgroundColor,
        onChangeFontFamily,
        onChangeFontSize,
        onBringToFront,
        onSendToBack,
        onOpenGenerationModal,
        onDownload,
        onStartCrop,
        onOpenAiImageEdit,
        onOpenImageToVideo,
        onMaximizeImage,
        onMinimizeImage,
        onChangeAspectRatio,
        onRegenerateImage,
        onDownloadImage,
        drawingTool,
        onUpdateItemDrawing,
        isPanning,
        isZooming,
        useInteractiveBackground,
    }) => {
    
  // Items should now render without interference

  const dotColor = getContrastingDotColor(backgroundColor);
  
  // When using interactive background, only show background color (no CSS dot grid)
  const gridStyle = useInteractiveBackground
    ? { backgroundColor: backgroundColor } as React.CSSProperties
    : {
        backgroundColor: backgroundColor,
        backgroundImage: `radial-gradient(circle at 1px 1px, ${dotColor} 1px, transparent 0)`,
        backgroundSize: `${dotDensity * panZoom.k}px ${dotDensity * panZoom.k}px`,
        backgroundPosition: `${panZoom.x}px ${panZoom.y}px`,
      } as React.CSSProperties;

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (canvasRef.current) {
        // Use consistent coordinate transformation to match the CSS transform
        const rect = canvasRef.current.getBoundingClientRect();
        const screenX = e.clientX - rect.left;  // Screen position relative to canvas
        const screenY = e.clientY - rect.top;   // Screen position relative to canvas
        
        // Reverse the CSS transform: translate(panZoom.x, panZoom.y) scale(panZoom.k)
        const x = (screenX - panZoom.x) / panZoom.k;
        const y = (screenY - panZoom.y) / panZoom.k;
        
        console.log('=== FILE DROP DEBUG ===');
        console.log('Drop position (screen):', { clientX: e.clientX, clientY: e.clientY });
        console.log('Canvas rect:', { left: rect.left, top: rect.top });
        console.log('PanZoom:', panZoom);
        console.log('Calculated canvas coords:', { x, y });
        
        const notePayload = e.dataTransfer.getData(NOTE_DRAG_TYPE);
        if (notePayload) {
          try {
            const note = JSON.parse(notePayload) as Partial<NoteSummary>;
            if (typeof note.id !== 'string' || typeof note.title !== 'string' || !Array.isArray(note.tags)) throw new Error('Invalid note drag payload');
            onNoteDrop(note as NoteSummary, x, y);
            return;
          } catch {
            return;
          }
        }
        if (e.dataTransfer.files.length) onFileDrop(e.dataTransfer.files, x, y);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = e.dataTransfer.types.includes(NOTE_DRAG_TYPE) ? 'copy' : 'move';
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    console.log('🎡 Board wheel event - deltaY:', e.deltaY);
    
    // Pass zoom delta to parent - allow zooming anywhere on canvas
    const delta = -e.deltaY * 0.001;
    onWheel(delta);
  };
  
  const selectionOverlay = selectionBox && selectionBox.width > 0 && selectionBox.height > 0
    ? {
        left: selectionBox.x * panZoom.k + panZoom.x,
        top: selectionBox.y * panZoom.k + panZoom.y,
        width: selectionBox.width * panZoom.k,
        height: selectionBox.height * panZoom.k,
      }
    : null;

  return (
    <div
      ref={canvasRef}
      data-canvas="true"
      className={`w-full h-screen overflow-hidden relative`}
      style={gridStyle}
      onMouseDown={onCanvasMouseDown}
      onMouseMove={onCanvasMouseMove}
      onMouseUp={onCanvasMouseUp}
      onClick={(e) => {
        console.log('🚨 BOARD DIV CLICKED - RAW EVENT', { target: e.target, currentTarget: e.currentTarget });
        onCanvasClick(e);
      }}
      onContextMenu={onCanvasContextMenu}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onWheel={handleWheel}
    >
      {/* Interactive Background Layer - behind everything, pointerEvents: none */}
      {useInteractiveBackground && (
        <InteractiveBGPattern
          dotSize={2}
          spacing={dotDensity}
          baseOpacity={0.15}
          glowOpacity={0.9}
          glowRadius={200}
          shape="rectangle"
          rectangleWidth={3}
          rectangleHeight={3}
          colorChangeEnabled={true}
          colorChangeInterval={3000}
          className="z-0"
        />
      )}
      <RelationshipLayer items={items} panZoom={panZoom} />
      <div
        ref={itemsContainerRef}
        className="transform-origin-top-left relative"
        style={{ 
          transform: `translate(${panZoom.x}px, ${panZoom.y}px) scale(${panZoom.k})`,
          transition: isPanning ? 'transform 80ms ease-out' : 'none',
        }}
      >
        {items.map(item => (
          <div 
            key={item.id} 
            className="board-item" 
            data-item-id={item.id} 
            tabIndex={-1} 
            style={{
              outline: 'none',
              // Frames need pointer-events:none on wrapper so clicks pass through to items inside
              pointerEvents: item.type === ItemType.Frame ? 'none' : undefined,
            }}
          >
             <BoardItemComponent
                item={item}
                isSelected={selectedItemIds.has(item.id)}
                isGenerating={generatingItems.has(item.id)}
                isInteractive={interactiveItemId === item.id}
                panZoom={panZoom}
                onMouseDown={onItemMouseDown}
                isEditing={editingItemId === item.id}
                onDoubleClick={(e) => onItemDoubleClick(item.id)}
                onTextChange={onTextChange}
                onResizeMouseDown={onResizeMouseDown}
                onRotationMouseDown={onRotationMouseDown}
                drawingTool={drawingTool}
                onUpdateDrawing={onUpdateItemDrawing ? (data) => onUpdateItemDrawing(item.id, data) : undefined}
            />
          </div>
        ))}
      </div>
      {selectionOverlay && (
        <div
          className="absolute border-2 border-red-500/80 bg-red-500/10 pointer-events-none"
          style={{
            left: selectionOverlay.left,
            top: selectionOverlay.top,
            width: selectionOverlay.width,
            height: selectionOverlay.height,
          }}
        />
      )}
      
      {/* ContextualToolbar now renders via portal, outside transform context */}
      {selectedItems.length > 0 && (
        <ContextualToolbar
            selectedItems={selectedItems}
            panZoom={panZoom}
            canvasRect={canvasRef.current ? canvasRef.current.getBoundingClientRect() : null}
            canvasElement={canvasRef.current}
            onChangeTextColor={onChangeTextColor}
            onChangeBackgroundColor={onChangeBackgroundColor}
            onChangeFontFamily={onChangeFontFamily}
            onChangeFontSize={onChangeFontSize}
            onBringToFront={onBringToFront}
            onSendToBack={onSendToBack}
            onOpenGenerationModal={onOpenGenerationModal}
            onDownload={onDownload}
            onStartCrop={onStartCrop}
            onOpenAiImageEdit={onOpenAiImageEdit}
            onOpenImageToVideo={onOpenImageToVideo}
            onMaximizeImage={onMaximizeImage}
            onMinimizeImage={onMinimizeImage}
            onChangeAspectRatio={onChangeAspectRatio}
            onRegenerateImage={onRegenerateImage}
            onDownloadImage={onDownloadImage}
        />
      )}
    </div>
  );
};