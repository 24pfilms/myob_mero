import React, { useState, useEffect } from 'react';
import { ItemType, ShapeType, BoardItem } from '../types';

interface PendingTool {
  type: ItemType;
  options?: Partial<BoardItem>;
}

interface MouseFollowerProps {
  pendingTool: PendingTool | null;
  canvasRef: React.RefObject<HTMLDivElement>;
}

export const MouseFollower: React.FC<MouseFollowerProps> = ({ pendingTool, canvasRef }) => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isOverCanvas, setIsOverCanvas] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
      
      // Check if mouse is over the canvas
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const isInside = e.clientX >= rect.left && 
                        e.clientX <= rect.right && 
                        e.clientY >= rect.top && 
                        e.clientY <= rect.bottom;
        setIsOverCanvas(isInside);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [canvasRef]);

  if (!pendingTool || !isOverCanvas) return null;

  const getPreviewContent = () => {
    switch (pendingTool.type) {
      case ItemType.StickyNote:
        return (
          <div className="w-24 h-24 bg-yellow-200 border border-yellow-400 rounded-lg flex items-center justify-center text-xs opacity-80 shadow-lg">
            Note
          </div>
        );
      case ItemType.TextBox:
        return (
          <div className="w-24 h-12 border-2 border-dashed border-blue-400 rounded flex items-center justify-center text-xs opacity-80 bg-transparent text-blue-400">
            Text
          </div>
        );
      case ItemType.Shape:
        const shape = pendingTool.options?.shape || ShapeType.Rectangle;
        return (
          <div className="w-24 h-24 flex items-center justify-center opacity-80">
            {shape === ShapeType.Circle && (
              <div className="w-20 h-20 border-2 border-gray-400 rounded-full bg-gray-200"></div>
            )}
            {shape === ShapeType.Rectangle && (
              <div className="w-20 h-16 border-2 border-gray-400 bg-gray-200"></div>
            )}
            {shape === ShapeType.Triangle && (
              <div className="w-0 h-0 border-l-10 border-r-10 border-b-16 border-l-transparent border-r-transparent border-b-gray-400"></div>
            )}
            {/* Add more shape previews as needed */}
          </div>
        );
      case ItemType.Frame:
        return (
          <div className="w-32 h-24 border-2 border-dashed border-purple-400 rounded flex items-center justify-center text-xs opacity-80 bg-transparent text-purple-400">
            Frame
          </div>
        );
      default:
        return (
          <div className="w-6 h-6 bg-blue-500 rounded-full opacity-80 shadow-lg"></div>
        );
    }
  };

  return (
    <div
      className="fixed pointer-events-none z-[9999] transform -translate-x-1/2 -translate-y-1/2"
      style={{
        left: mousePosition.x,
        top: mousePosition.y,
      }}
    >
      {getPreviewContent()}
      {/* Crosshair overlay */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
        <div className="w-4 h-0.5 bg-red-500 absolute -translate-x-1/2 -translate-y-1/2"></div>
        <div className="h-4 w-0.5 bg-red-500 absolute -translate-x-1/2 -translate-y-1/2"></div>
      </div>
    </div>
  );
};