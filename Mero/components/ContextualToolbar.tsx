import React, { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { BoardItem, ItemType, ShapeType } from '../types';
import { ArrowUpIcon, ArrowDownIcon, NoFillIcon, SparklesIcon, DownloadIcon, CropIcon, VideoIcon, MaximizeIcon, MinimizeIcon, AspectRatioIcon, RefreshIcon, ImageEditIcon, FontSizeIncreaseIcon, FontSizeDecreaseIcon } from './icons';

interface ColorInputProps {
  label: string;
  color: string;
  onChange: (color: string) => void;
}

const ColorInput: React.FC<ColorInputProps> = ({ label, color, onChange }) => {
    const inputId = `color-picker-${label.replace(/\s+/g, '-')}`;
    return (
        <div className="relative" title={label}>
            <label
                htmlFor={inputId}
                className="p-1 rounded-md hover:bg-gray-700 cursor-pointer block"
                aria-label={label}
            >
                <div 
                    className="w-2.5 h-2.5 rounded-full" 
                    style={{ 
                        backgroundColor: color, 
                        boxShadow: '0 0 0 1px rgba(255,255,255,0.2)' 
                    }}
                ></div>
            </label>
            <input
                id={inputId}
                type="color"
                value={color}
                onChange={(e) => onChange(e.target.value)}
                className="absolute w-0 h-0 opacity-0"
            />
        </div>
    );
};

const ToolButton = ({ children, onClick, tooltip }: { children: React.ReactNode; onClick: () => void; tooltip: string }) => (
    <div className="relative group">
        <button
            onClick={onClick}
            className={'p-1 rounded-md hover:bg-gray-700'}
            aria-label={tooltip}
        >
            {children}
        </button>
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 w-max px-1 py-0.5 bg-gray-900 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg border border-gray-700">
            {tooltip}
        </div>
    </div>
);

const FONTS = [
    { name: "Inter", family: "Inter, sans-serif" },
    { name: "Roboto Slab", family: "'Roboto Slab', serif" },
    { name: "Fira Code", family: "'Fira Code', monospace" },
    { name: "Caveat", family: "'Caveat', cursive" },
    { name: "Poppins", family: "'Poppins', sans-serif" },
];

interface ContextualToolbarProps {
  selectedItems: BoardItem[];
  panZoom: { k: number; x: number; y: number };
  canvasRect: DOMRect | null;
  canvasElement?: HTMLDivElement | null;
  onChangeTextColor: (color: string) => void;
  onChangeBackgroundColor: (color: string) => void;
  onChangeFontFamily: (font: string) => void;
  onChangeFontSize: (delta: number) => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onOpenGenerationModal: (itemId: string) => void;
  onDownload: (itemId: string) => void;
  onStartCrop: (itemId: string) => void;
  onOpenAiImageEdit?: (item: BoardItem) => void;
  onOpenImageToVideo?: (item: BoardItem) => void;
  onMaximizeImage?: (itemId: string) => void;
  onMinimizeImage?: (itemId: string) => void;
  onChangeAspectRatio?: (itemId: string, ratio: string) => void;
  onRegenerateImage?: (itemId: string) => void;
  onDownloadImage?: (itemId: string) => void;
}

export const ContextualToolbar: React.FC<ContextualToolbarProps> = ({
  selectedItems,
  panZoom,
  canvasRect,
  canvasElement,
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
  onDownloadImage
}) => {
  const toolbarRef = useRef<HTMLDivElement>(null);

  if (selectedItems.length === 0) return null;

  const bounds = selectedItems.reduce((acc, item) => ({
    minX: Math.min(acc.minX, item.x),
    minY: Math.min(acc.minY, item.y),
    maxX: Math.max(acc.maxX, item.x + item.width),
    maxY: Math.max(acc.maxY, item.y + item.height),
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });

  const avgTextColor = selectedItems[0]?.textColor || '#FFFFFF';
  const avgBgColor = selectedItems[0]?.backgroundColor || '#1f2937';
  const avgFontFamily = selectedItems[0]?.fontFamily || FONTS[0].family;
  
  const showFontSelector = selectedItems.some(item => [ItemType.StickyNote, ItemType.Shape, ItemType.TextBox, ItemType.Frame].includes(item.type));
  const showBackgroundColor = selectedItems.some(item => [ItemType.StickyNote, ItemType.Shape, ItemType.Frame].includes(item.type));
  const showGeneration = selectedItems.length === 1 && selectedItems[0].type === ItemType.Shape && !selectedItems[0].generatedImageUrl && !selectedItems[0].generatedVideoUrl;
  const showDownload = selectedItems.length === 1 && !!selectedItems[0].generatedVideoUrl;
  const showCrop = selectedItems.length === 1 && selectedItems[0].type === ItemType.Image;
  
  // New image-specific features
  const selectedImage = selectedItems.length === 1 && selectedItems[0].type === ItemType.Image ? selectedItems[0] : null;
  const showImageFeatures = !!selectedImage;
  const showMaximize = showImageFeatures && !selectedImage.isMaximized;
  const showMinimize = showImageFeatures && selectedImage.isMaximized;
  const showVideoGeneration = showImageFeatures && selectedImage.src;
  const showRegenerateImage = showImageFeatures && selectedImage.aiEditHistory && selectedImage.aiEditHistory.length > 0;
  const showDownloadImage = showImageFeatures && selectedImage.src;

  const toolbarOffsetY = 40;
  const canvasLeft = canvasRect?.left ?? 0;
  const canvasTop = canvasRect?.top ?? 0;
  const worldCenterX = bounds.minX + (bounds.maxX - bounds.minX) / 2;
  const worldTopY = bounds.minY;
  const screenX = canvasLeft + panZoom.x + worldCenterX * panZoom.k;
  const screenY = canvasTop + panZoom.y + worldTopY * panZoom.k - toolbarOffsetY;

  // Use useLayoutEffect to update position synchronously with CSS transforms
  // This prevents the toolbar from drifting during zoom operations
  useLayoutEffect(() => {
    // Get fresh canvas rect every time to ensure accuracy
    const freshCanvasRect = canvasElement ? canvasElement.getBoundingClientRect() : canvasRect;
    
    if (toolbarRef.current && freshCanvasRect && selectedItems.length > 0) {
      // Instead of calculating from world coords, get the ACTUAL screen position of the first item
      const firstItem = selectedItems[0];
      
      // Query the actual BoardItemComponent, not the wrapper div
      // The BoardItemComponent has the actual positioned content
      const itemElement = document.querySelector(`[data-item-id="${firstItem.id}"] > div`);
      
      if (itemElement) {
        const actualRect = itemElement.getBoundingClientRect();
        
        // Calculate center X of the selection bounds on screen
        // For multiple items, we need to find the screen bounds of all items
        let minScreenX = Infinity, minScreenY = Infinity;
        let maxScreenX = -Infinity, maxScreenY = -Infinity;
        
        selectedItems.forEach(item => {
          const el = document.querySelector(`[data-item-id="${item.id}"] > div`);
          if (el) {
            const rect = el.getBoundingClientRect();
            minScreenX = Math.min(minScreenX, rect.left);
            minScreenY = Math.min(minScreenY, rect.top);
            maxScreenX = Math.max(maxScreenX, rect.right);
            maxScreenY = Math.max(maxScreenY, rect.bottom);
          }
        });
        
        const screenCenterX = (minScreenX + maxScreenX) / 2;
        const screenTopY = minScreenY;
        const updatedScreenY = screenTopY - toolbarOffsetY;
        
        // DEBUG: Log position calculations
        console.log('🎯 TOOLBAR POSITION DEBUG:', {
          selectedItemCount: selectedItems.length,
          worldBounds: { minX: bounds.minX, minY: bounds.minY, maxX: bounds.maxX, maxY: bounds.maxY },
          worldCenter: { x: worldCenterX, y: worldTopY },
          panZoom: { x: panZoom.x, y: panZoom.y, k: panZoom.k },
          canvasRect: { left: freshCanvasRect.left, top: freshCanvasRect.top, width: freshCanvasRect.width, height: freshCanvasRect.height },
          screenBounds: { minX: minScreenX, minY: minScreenY, maxX: maxScreenX, maxY: maxScreenY },
          screenCenter: { x: screenCenterX, y: screenTopY },
          toolbarPosition: { x: screenCenterX, y: updatedScreenY }
        });
        
        // Update position directly in the DOM for synchronous rendering
        toolbarRef.current.style.left = `${screenCenterX}px`;
        toolbarRef.current.style.top = `${updatedScreenY}px`;
      }
    }
  }, [panZoom.x, panZoom.y, panZoom.k, worldCenterX, worldTopY, canvasRect, canvasElement, toolbarOffsetY, selectedItems, bounds]);

  const toolbarContent = (
    <div
      className="fixed contextual-toolbar pointer-events-none"
      style={{
        top: 0,
        left: 0,
        zIndex: 9998,
        width: '100%',
        height: '100%',
      }}
    >
      <div 
        ref={toolbarRef}
        className="absolute pointer-events-auto flex items-center gap-0.5 p-0.5 bg-gray-800 rounded-md shadow-lg text-gray-200 text-xs"
        style={{
          top: `${screenY}px`,
          left: `${screenX}px`,
          transform: 'translateX(-50%) translateY(-100%)',
          transformOrigin: 'bottom center',
        }}
      >
        {showFontSelector && (
          <div className="relative group">
            <select
              value={avgFontFamily}
              onChange={(e) => onChangeFontFamily(e.target.value)}
              className="bg-gray-700 text-white text-xs text-center rounded-md px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none min-w-20"
              style={{ fontFamily: avgFontFamily, fontSize: '11px' }}
            >
              {FONTS.map(font => (
                <option key={font.name} value={font.family} style={{ fontFamily: font.family }}>
                  {font.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {showFontSelector && (
          <>
            <ToolButton onClick={() => onChangeFontSize(-2)} tooltip="Decrease Font Size">
              <FontSizeDecreaseIcon />
            </ToolButton>
            <ToolButton onClick={() => onChangeFontSize(2)} tooltip="Increase Font Size">
              <FontSizeIncreaseIcon />
            </ToolButton>
          </>
        )}

        {showFontSelector && (
            <ColorInput label="Text Color" color={avgTextColor} onChange={onChangeTextColor} />
        )}

        {showBackgroundColor && (
          <>
            <ColorInput label="Background Color" color={avgBgColor} onChange={onChangeBackgroundColor} />
            <ToolButton onClick={() => onChangeBackgroundColor('transparent')} tooltip="No Fill">
              <NoFillIcon />
            </ToolButton>
          </>
        )}
        
        {showGeneration && (
            <ToolButton onClick={() => onOpenGenerationModal(selectedItems[0].id)} tooltip="Generate Media">
                <SparklesIcon />
            </ToolButton>
        )}

        {showDownload && (
             <ToolButton onClick={() => onDownload(selectedItems[0].id)} tooltip="Download Video">
                <DownloadIcon />
            </ToolButton>
        )}

        {showCrop && (
            <ToolButton onClick={() => onStartCrop(selectedItems[0].id)} tooltip="Crop Image">
                <CropIcon />
            </ToolButton>
        )}
        
        {/* AI Image Editing */}
        {showImageFeatures && onOpenAiImageEdit && (
            <ToolButton onClick={() => onOpenAiImageEdit(selectedImage)} tooltip="Edit with AI">
                <ImageEditIcon />
            </ToolButton>
        )}
        
        {/* Image to Video */}
        {showVideoGeneration && onOpenImageToVideo && (
            <ToolButton onClick={() => onOpenImageToVideo(selectedImage)} tooltip="Generate Video">
                <VideoIcon />
            </ToolButton>
        )}
        
        {/* Maximize/Minimize */}
        {showMaximize && onMaximizeImage && (
            <ToolButton onClick={() => onMaximizeImage(selectedItems[0].id)} tooltip="Maximize Image">
                <MaximizeIcon />
            </ToolButton>
        )}
        {showMinimize && onMinimizeImage && (
            <ToolButton onClick={() => onMinimizeImage(selectedItems[0].id)} tooltip="Minimize Image">
                <MinimizeIcon />
            </ToolButton>
        )}
        
        {/* Regenerate Image */}
        {showRegenerateImage && onRegenerateImage && (
            <ToolButton onClick={() => onRegenerateImage(selectedItems[0].id)} tooltip="Regenerate Image">
                <RefreshIcon />
            </ToolButton>
        )}
        
        {/* Download Image */}
        {showDownloadImage && onDownloadImage && (
            <ToolButton onClick={() => onDownloadImage(selectedItems[0].id)} tooltip="Download Image">
                <DownloadIcon />
            </ToolButton>
        )}

        <div className="w-px h-3 bg-gray-600 mx-0.5"></div>

        <ToolButton onClick={onBringToFront} tooltip="Bring to Front">
          <ArrowUpIcon />
        </ToolButton>
        <ToolButton onClick={onSendToBack} tooltip="Send to Back">
          <ArrowDownIcon />
        </ToolButton>
      </div>
    </div>
  );
  
  // Render toolbar using portal to ensure it's outside any transform context
  return createPortal(toolbarContent, document.body);
};
