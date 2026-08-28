import React, { useState, useRef, useEffect } from 'react';
import { BoardItem } from '../types';

interface CroppingUIProps {
  item: BoardItem;
  onApply: (itemId: string, crop: { x: number; y: number; width: number; height: number; }) => void;
  onCancel: () => void;
}

type Handle = 'top-left' | 'top' | 'top-right' | 'left' | 'right' | 'bottom-left' | 'bottom' | 'bottom-right' | 'move';

export const CroppingUI: React.FC<CroppingUIProps> = ({ item, onApply, onCancel }) => {
  const [cropBox, setCropBox] = useState(() => {
    const original = { x: 0, y: 0, width: item.originalWidth || item.width, height: item.originalHeight || item.height };
    return item.crop || original;
  });

  const dragInfo = useRef<{ activeHandle: Handle | null; startX: number; startY: number; startCropBox: typeof cropBox } | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const handleMouseDown = (e: React.MouseEvent, handle: Handle) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('=== CROP HANDLE MOUSEDOWN ===');
    console.log('Handle:', handle);
    console.log('Mouse position:', { x: e.clientX, y: e.clientY });
    console.log('Current crop box:', cropBox);
    
    dragInfo.current = {
      activeHandle: handle,
      startX: e.clientX,
      startY: e.clientY,
      startCropBox: cropBox,
    };
    
    // Use capture phase to ensure we get the events
    window.addEventListener('mousemove', handleMouseMove, { capture: true });
    window.addEventListener('mouseup', handleMouseUp, { capture: true });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!dragInfo.current || !imageRef.current) return;
    const { activeHandle, startX, startY, startCropBox } = dragInfo.current;
    
    const imageRect = imageRef.current.getBoundingClientRect();
    const dx = (e.clientX - startX) * (item.originalWidth! / imageRect.width);
    const dy = (e.clientY - startY) * (item.originalHeight! / imageRect.height);
    
    console.log('=== CROP MOUSE MOVE ===');
    console.log('Active handle:', activeHandle);
    console.log('Mouse delta:', { dx, dy });
    console.log('Image rect:', imageRect);

    let { x, y, width, height } = startCropBox;
    const minSize = 20;

    if (activeHandle === 'move') {
      x = Math.max(0, Math.min(startCropBox.x + dx, item.originalWidth! - width));
      y = Math.max(0, Math.min(startCropBox.y + dy, item.originalHeight! - height));
    }
    if (activeHandle?.includes('right')) {
        width = Math.min(item.originalWidth! - x, Math.max(minSize, startCropBox.width + dx));
    }
    if (activeHandle?.includes('left')) {
        const newWidth = Math.max(minSize, startCropBox.width - dx);
        x = Math.max(0, startCropBox.x + startCropBox.width - newWidth);
        width = newWidth;
    }
    if (activeHandle?.includes('bottom')) {
        height = Math.min(item.originalHeight! - y, Math.max(minSize, startCropBox.height + dy));
    }
    if (activeHandle?.includes('top')) {
        const newHeight = Math.max(minSize, startCropBox.height - dy);
        y = Math.max(0, startCropBox.y + startCropBox.height - newHeight);
        height = newHeight;
    }

    setCropBox({ x, y, width, height });
  };

  const handleMouseUp = () => {
    console.log('=== CROP MOUSE UP ===');
    dragInfo.current = null;
    window.removeEventListener('mousemove', handleMouseMove, { capture: true } as any);
    window.removeEventListener('mouseup', handleMouseUp, { capture: true } as any);
  };
  
  if (!item.src || !item.originalWidth || !item.originalHeight) return null;

  return (
    <div className="fixed inset-0 z-[2000] bg-black/80 flex flex-col items-center justify-center p-4">
      <div className="relative" style={{ maxWidth: '80vw', maxHeight: '70vh' }}>
        <img
          ref={imageRef}
          src={item.src}
          alt="Cropping preview"
          className="max-w-full max-h-full"
          style={{ opacity: 0.5 }}
          draggable={false}
        />
        <div 
          className="absolute top-0 left-0"
          style={{
            transform: `scale(${imageRef.current ? imageRef.current.getBoundingClientRect().width / item.originalWidth : 1})`,
            transformOrigin: 'top left',
            width: item.originalWidth,
            height: item.originalHeight,
          }}
        >
          <div
            className="absolute shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] cursor-move border-2 border-white"
            style={{
              left: cropBox.x,
              top: cropBox.y,
              width: cropBox.width,
              height: cropBox.height,
              backgroundImage: `url(${item.src})`,
              backgroundSize: `${item.originalWidth}px ${item.originalHeight}px`,
              backgroundPosition: `-${cropBox.x}px -${cropBox.y}px`,
              // Add inner white border for better visibility
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.6), inset 0 0 0 2px white',
            }}
            onMouseDown={(e) => handleMouseDown(e, 'move')}
          >
            {/* Corner handles - Made MUCH larger and impossible to miss */}
            <div className="absolute -top-5 -left-5 w-10 h-10 bg-white border-3 border-blue-600 rounded-full cursor-nwse-resize shadow-xl hover:bg-blue-50 hover:scale-110 transition-all duration-150 z-10" onMouseDown={(e) => handleMouseDown(e, 'top-left')} />
            <div className="absolute -top-5 -right-5 w-10 h-10 bg-white border-3 border-blue-600 rounded-full cursor-nesw-resize shadow-xl hover:bg-blue-50 hover:scale-110 transition-all duration-150 z-10" onMouseDown={(e) => handleMouseDown(e, 'top-right')} />
            <div className="absolute -bottom-5 -left-5 w-10 h-10 bg-white border-3 border-blue-600 rounded-full cursor-nesw-resize shadow-xl hover:bg-blue-50 hover:scale-110 transition-all duration-150 z-10" onMouseDown={(e) => handleMouseDown(e, 'bottom-left')} />
            <div className="absolute -bottom-5 -right-5 w-10 h-10 bg-white border-3 border-blue-600 rounded-full cursor-nwse-resize shadow-xl hover:bg-blue-50 hover:scale-110 transition-all duration-150 z-10" onMouseDown={(e) => handleMouseDown(e, 'bottom-right')} />
            {/* Edge handles - Made MUCH larger and more prominent */}
            <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-10 h-10 bg-white border-3 border-blue-600 rounded-full cursor-ns-resize shadow-xl hover:bg-blue-50 hover:scale-110 transition-all duration-150 z-10" onMouseDown={(e) => handleMouseDown(e, 'top')} />
            <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 w-10 h-10 bg-white border-3 border-blue-600 rounded-full cursor-ns-resize shadow-xl hover:bg-blue-50 hover:scale-110 transition-all duration-150 z-10" onMouseDown={(e) => handleMouseDown(e, 'bottom')} />
            <div className="absolute top-1/2 -translate-y-1/2 -left-5 w-10 h-10 bg-white border-3 border-blue-600 rounded-full cursor-ew-resize shadow-xl hover:bg-blue-50 hover:scale-110 transition-all duration-150 z-10" onMouseDown={(e) => handleMouseDown(e, 'left')} />
            <div className="absolute top-1/2 -translate-y-1/2 -right-5 w-10 h-10 bg-white border-3 border-blue-600 rounded-full cursor-ew-resize shadow-xl hover:bg-blue-50 hover:scale-110 transition-all duration-150 z-10" onMouseDown={(e) => handleMouseDown(e, 'right')} />
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 flex gap-4">
        <button
          onClick={onCancel}
          className="px-8 py-3 rounded-lg font-semibold text-white bg-gray-700 hover:bg-gray-600 transition-colors shadow-lg border border-gray-500"
        >
          Cancel
        </button>
        <button
          onClick={() => onApply(item.id, cropBox)}
          className="px-8 py-3 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-lg border border-blue-400"
        >
          Apply Crop
        </button>
      </div>
      
      {/* Instructions */}
      <div className="absolute top-8 left-1/2 transform -translate-x-1/2 text-white text-center">
        <p className="text-lg font-semibold mb-2">Crop Image</p>
        <p className="text-sm text-gray-300">Drag the handles to adjust the crop area, or drag inside to move</p>
      </div>
    </div>
  );
};