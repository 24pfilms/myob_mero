import React, { useState, useEffect, useRef } from 'react';
import { BoardItem } from '../types';
import { BotIcon, XIcon, PenToolIcon } from './icons';
import { compositeImageWithDrawing } from '../utils/compositeImage';

interface AiImageEditModalProps {
  isOpen: boolean;
  item: BoardItem;
  onClose: () => void;
  onApply: (itemId: string, newImageUrl: string, prompt: string, originalUrl?: string, newDimensions?: { width: number; height: number }) => void;
  onClearDrawing?: (itemId: string) => void;
  onStartEditing?: (itemId: string) => void;
  onStopEditing?: (itemId: string) => void;
}

export const AiImageEditModal: React.FC<AiImageEditModalProps> = ({
  isOpen,
  item,
  onClose,
  onApply,
  onClearDrawing,
  onStartEditing,
  onStopEditing
}) => {
  const [prompt, setPrompt] = useState('');
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [compositedPreview, setCompositedPreview] = useState<string | null>(null);
  const [isCompositing, setIsCompositing] = useState(false);
  
  const modalRef = useRef<HTMLDivElement>(null);
  
  // Check if item has pen markup
  const hasMarkup = !!item.drawingData;
  const promptSuggestions = [
    "Make it look like a vintage photograph",
    "Add dramatic lighting and shadows",
    "Transform into a watercolor painting style",
    "Make it appear taken at golden hour",
    "Add motion blur effect",
    "Convert to black and white with high contrast",
    "Make it look like a professional portrait",
    "Add a dreamy, soft focus effect"
  ];

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setPrompt('');
      setPosition({ x: 0, y: 0 });
      setCompositedPreview(null);
    }
  }, [isOpen]);
  
  // Composite image with drawing when markup exists
  useEffect(() => {
    if (isOpen && hasMarkup && item.src && item.drawingData) {
      setIsCompositing(true);
      compositeImageWithDrawing(item.src, item.drawingData, item.width, item.height)
        .then((composited) => {
          setCompositedPreview(composited);
          setIsCompositing(false);
        })
        .catch((err) => {
          console.error('Failed to composite image with markup:', err);
          setIsCompositing(false);
        });
    }
  }, [isOpen, hasMarkup, item.src, item.drawingData, item.width, item.height]);

  // Drag handlers for modal movement
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.modal-header')) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  const handleEditImage = () => {
    if (!prompt.trim() || !item.src) return;
    alert('AI image editing is unavailable until a server-side provider is configured.');
  };


  const handleSuggestionClick = (suggestion: string) => {
    setPrompt(suggestion);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      {/* Electric backdrop */}
      <div className="absolute inset-0 bg-slate-950/95" onClick={onClose}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-600/20 via-transparent to-transparent" />
      </div>
      
      {/* Modal */}
      <div 
        ref={modalRef}
        className="relative w-full max-w-4xl max-h-[90vh]"
        style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
        onClick={e => e.stopPropagation()}
        onMouseDown={handleMouseDown}
      >
        {/* Electric glow */}
        <div className="absolute -inset-2 bg-blue-500/20 rounded-3xl blur-xl animate-pulse" />
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 rounded-2xl opacity-60" />
        
        {/* Glass card */}
        <div 
          className="relative bg-slate-900/90 backdrop-blur-xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
          style={{ cursor: isDragging ? 'grabbing' : 'default' }}
        >
          {/* Animated top bar */}
          <div className="h-1 bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-600 animate-pulse" />
          
          {/* Header */}
          <div className="modal-header flex items-center justify-between px-6 py-4 cursor-grab active:cursor-grabbing select-none">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/40">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">AI Image Editor</h2>
                <p className="text-xs text-blue-400">Powered by Nano Banana</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-blue-500/20"
            >
              <XIcon />
            </button>
          </div>

        {/* Content */}
        <div className="flex-1 flex gap-6 p-6 overflow-y-auto border-t border-blue-500/20">
          {/* Left Panel - Original Image & Controls */}
          <div className="flex-1 flex flex-col gap-4">
            {/* Image Preview */}
            <div className="bg-slate-800/50 rounded-xl p-4 flex flex-col border border-blue-500/20 max-h-[300px]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-300">
                  {hasMarkup ? 'Image with Markup' : 'Original Image'}
                </h3>
                {hasMarkup && (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500/20 rounded-full border border-red-500/30">
                    <PenToolIcon />
                    <span className="text-xs text-red-300 font-medium">Markup Active</span>
                  </div>
                )}
              </div>
              
              {/* Markup info banner */}
              {hasMarkup && (
                <div className="mb-3 p-2 bg-gradient-to-r from-red-500/10 to-orange-500/10 rounded-lg border border-red-500/20">
                  <p className="text-xs text-red-300">
                    <strong>✏️ Pen markup detected!</strong> The AI will focus on editing the marked areas.
                  </p>
                </div>
              )}
              
              <div className="flex-1 flex items-center justify-center bg-slate-900/50 rounded-lg overflow-hidden relative">
                {isCompositing ? (
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
                    <span className="text-sm">Preparing preview...</span>
                  </div>
                ) : item.src ? (
                  <img
                    src={hasMarkup && compositedPreview ? compositedPreview : item.src}
                    alt={hasMarkup ? "Image with markup" : "Original"}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <div className="text-gray-500">No image selected</div>
                )}
              </div>
            </div>

            {/* Prompt Input */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-gray-300">Edit Instructions</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe how you want to edit this image..."
                className="w-full h-24 p-3 bg-slate-800/50 text-white rounded-lg border border-blue-500/30 focus:ring-2 focus:ring-cyan-500 focus:border-transparent focus:outline-none resize-none placeholder-gray-500"
              />
              
              {/* Prompt Suggestions */}
              <div className="space-y-2">
                <label className="text-xs text-blue-400/70">Quick suggestions:</label>
                <div className="flex flex-wrap gap-2">
                  {promptSuggestions.slice(0, 4).map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="text-xs px-3 py-1.5 bg-slate-800/50 text-gray-300 rounded-full border border-blue-500/20 hover:bg-blue-500/20 hover:text-cyan-300 hover:border-cyan-500/40 transition-all"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Edit Button */}
            <button
              onClick={handleEditImage}
              disabled={!prompt.trim()}
              className="w-full py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed shadow-lg shadow-blue-500/30 transition-all"
            >
              Generate AI Edit
            </button>
          </div>

          {/* Right Panel - Info & Instructions */}
          <div className="flex-1 flex flex-col gap-4">
            <div className="bg-slate-800/50 rounded-xl p-4 flex-1 flex flex-col border border-blue-500/20">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">How it works</h3>
              
              <div className="flex-1 flex flex-col justify-center text-gray-400 text-sm space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-blue-500/30">1</div>
                  <p>Describe your desired edit in the text box</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-blue-500/30">2</div>
                  <p>Click "Generate AI Edit" to start processing</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-blue-500/30">3</div>
                  <p>The AI will edit your image and replace it on the canvas</p>
                </div>
                
                <div className="mt-6 p-3 bg-blue-500/10 rounded-lg border border-cyan-500/30">
                  <p className="text-cyan-300 text-xs">
                    <strong>Powered by Google's Nano Banana</strong><br/>
                    State-of-the-art AI image editing model
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};