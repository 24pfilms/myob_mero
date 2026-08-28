import React from 'react';
import { ContextMenuData, BoardItem, ItemType } from '../types';
import { VoteIcon, ImageEditIcon, VideoIcon, MaximizeIcon, MinimizeIcon, DownloadIcon, RefreshIcon } from './icons';

interface ContextMenuProps {
  data: ContextMenuData;
  items: BoardItem[];
  onClose: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onAddVote: () => void;
  onDelete: () => void;
  onOpenAiImageEdit?: (item: BoardItem) => void;
  onOpenImageToVideo?: (item: BoardItem) => void;
  onMaximizeImage?: (itemId: string) => void;
  onMinimizeImage?: (itemId: string) => void;
  onDownloadImage?: (itemId: string) => void;
  onRegenerateImage?: (itemId: string) => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ data, items, onClose, onBringToFront, onSendToBack, onAddVote, onDelete, onOpenAiImageEdit, onOpenImageToVideo, onMaximizeImage, onMinimizeImage, onDownloadImage, onRegenerateImage }) => {
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const buttonClass = "w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2";
  
  // Check if the selected item is an image
  const selectedItem = data.itemIds.length === 1 ? items.find(item => item.id === data.itemIds[0]) : null;
  const isImageItem = selectedItem?.type === ItemType.Image && selectedItem?.src;
  
  const handleAiEdit = () => {
    if (selectedItem && onOpenAiImageEdit) {
      onOpenAiImageEdit(selectedItem);
      onClose();
    }
  };
  
  const handleImageToVideo = () => {
    if (selectedItem && onOpenImageToVideo) {
      onOpenImageToVideo(selectedItem);
      onClose();
    }
  };
  
  const handleMaximize = () => {
    if (selectedItem && onMaximizeImage) {
      onMaximizeImage(selectedItem.id);
      onClose();
    }
  };
  
  const handleMinimize = () => {
    if (selectedItem && onMinimizeImage) {
      onMinimizeImage(selectedItem.id);
      onClose();
    }
  };
  
  const handleDownloadImage = () => {
    if (selectedItem && onDownloadImage) {
      onDownloadImage(selectedItem.id);
      onClose();
    }
  };
  
  const handleRegenerateImage = () => {
    if (selectedItem && onRegenerateImage) {
      onRegenerateImage(selectedItem.id);
      onClose();
    }
  };

  return (
    <div
      ref={menuRef}
      className="absolute z-[100000] w-48 rounded-md bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none py-1 ring-gray-600"
      style={{ top: data.y, left: data.x }}
    >
      <button onClick={onBringToFront} className={buttonClass}>Bring to Front</button>
      <button onClick={onSendToBack} className={buttonClass}>Send to Back</button>
       <button onClick={onAddVote} className={buttonClass}><VoteIcon/>Add Vote</button>
      {isImageItem && (
        <>
          <div className="border-t my-1 border-gray-600"></div>
          {onOpenAiImageEdit && (
            <button onClick={handleAiEdit} className={`${buttonClass} ${selectedItem?.drawingData ? 'text-red-400 hover:bg-red-900/50' : 'text-blue-400 hover:bg-blue-900/50'}`}>
              <ImageEditIcon />{selectedItem?.drawingData ? 'Edit marked area...' : 'Edit with AI'}
            </button>
          )}
          {onOpenImageToVideo && (
            <button onClick={handleImageToVideo} className={`${buttonClass} text-purple-400 hover:bg-purple-900/50`}>
              <VideoIcon />Generate Video
            </button>
          )}
          {!selectedItem?.isMaximized && onMaximizeImage && (
            <button onClick={handleMaximize} className={`${buttonClass} text-green-400 hover:bg-green-900/50`}>
              <MaximizeIcon />Maximize
            </button>
          )}
          {selectedItem?.isMaximized && onMinimizeImage && (
            <button onClick={handleMinimize} className={`${buttonClass} text-yellow-400 hover:bg-yellow-900/50`}>
              <MinimizeIcon />Minimize
            </button>
          )}
          {onDownloadImage && (
            <button onClick={handleDownloadImage} className={`${buttonClass} text-indigo-400 hover:bg-indigo-900/50`}>
              <DownloadIcon />Download
            </button>
          )}
          {selectedItem?.aiEditHistory && selectedItem.aiEditHistory.length > 0 && onRegenerateImage && (
            <button onClick={handleRegenerateImage} className={`${buttonClass} text-orange-400 hover:bg-orange-900/50`}>
              <RefreshIcon />Regenerate
            </button>
          )}
        </>
      )}
      <div className="border-t my-1 border-gray-600"></div>
      <button onClick={onDelete} className={`${buttonClass} text-red-500 hover:bg-red-900/50`}>Delete</button>
    </div>
  );
};