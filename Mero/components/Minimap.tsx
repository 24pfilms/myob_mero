import React from 'react';
// FIX: Import ItemType to be used in type checking.
import { BoardItem, PanZoom, ItemType } from '../types';

interface MinimapProps {
  items: BoardItem[];
  panZoom: PanZoom;
  viewport: { width: number; height: number };
}

const MINIMAP_SIZE = 200;

export const Minimap: React.FC<MinimapProps> = ({ items, panZoom, viewport }) => {
  if (items.length === 0) {
    return null;
  }

  const bounds = items.reduce((acc, item) => ({
    minX: Math.min(acc.minX, item.x),
    minY: Math.min(acc.minY, item.y),
    maxX: Math.max(acc.maxX, item.x + item.width),
    maxY: Math.max(acc.maxY, item.y + item.height),
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });

  const contentWidth = bounds.maxX - bounds.minX;
  const contentHeight = bounds.maxY - bounds.minY;

  if (contentWidth <= 0 || contentHeight <= 0) {
    return null;
  }
  
  const scale = Math.min(MINIMAP_SIZE / contentWidth, MINIMAP_SIZE / contentHeight);

  const mapWidth = contentWidth * scale;
  const mapHeight = contentHeight * scale;

  const viewportOnBoard = {
    x: -panZoom.x / panZoom.k,
    y: -panZoom.y / panZoom.k,
    width: viewport.width / panZoom.k,
    height: viewport.height / panZoom.k,
  };

  const viewportOnMap = {
    x: (viewportOnBoard.x - bounds.minX) * scale,
    y: (viewportOnBoard.y - bounds.minY) * scale,
    width: viewportOnBoard.width * scale,
    height: viewportOnBoard.height * scale,
  };

  return (
    <div 
      className="fixed bottom-4 left-4 z-50 bg-white/70 backdrop-blur-sm shadow-lg rounded-md border border-gray-200 overflow-hidden dark:bg-gray-800/70 dark:border-gray-600"
      style={{ width: mapWidth, height: mapHeight }}
    >
      <div className="relative w-full h-full">
        {items.map(item => (
          <div
            key={item.id}
            className="absolute"
            style={{
              left: (item.x - bounds.minX) * scale,
              top: (item.y - bounds.minY) * scale,
              width: item.width * scale,
              height: item.height * scale,
              backgroundColor: item.type === ItemType.Frame ? 'rgba(0,0,0,0.05)' : item.backgroundColor,
              border: item.type === ItemType.Frame ? '1px dashed grey' : 'none',
            }}
          />
        ))}
        <div
          className="absolute border-2 border-blue-500 bg-blue-500/10"
          style={{
            left: viewportOnMap.x,
            top: viewportOnMap.y,
            width: viewportOnMap.width,
            height: viewportOnMap.height,
          }}
        />
      </div>
    </div>
  );
};