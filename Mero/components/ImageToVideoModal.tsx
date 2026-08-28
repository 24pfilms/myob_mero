import React, { useState, useEffect, useRef } from 'react';
import { BoardItem } from '../types';
import { BotIcon, XIcon } from './icons';

interface ImageToVideoModalProps {
  isOpen: boolean;
  item: BoardItem;
  onClose: () => void;
  onVideoGenerated: (itemId: string, videoUrl: string, prompt: string) => void;
}

export const ImageToVideoModal: React.FC<ImageToVideoModalProps> = ({
  isOpen,
  item,
  onClose,
  onVideoGenerated
}) => {
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState<'short' | 'medium' | 'long'>('short');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '1:1' | '9:16'>('16:9');
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const modalRef = useRef<HTMLDivElement>(null);
  const promptSuggestions = [
    "Camera slowly zooms in on the subject",
    "Gentle wind makes everything sway naturally",
    "Subtle lighting changes create depth",
    "Smooth camera pan from left to right",
    "Water or leaves gently moving",
    "Clouds slowly drifting in the background",
    "Subject turns head slightly towards camera",
    "Soft focus changes throughout the scene"
  ];

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setPrompt('');
      setDuration('short');
      setAspectRatio('16:9');
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen]);

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

  const handleGenerateVideo = () => {
    if (!prompt.trim() || !item.src) return;
    alert('AI video generation is unavailable until a server-side provider is configured.');
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
        className="relative w-full max-w-2xl"
        style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
        onClick={e => e.stopPropagation()}
        onMouseDown={handleMouseDown}
      >
        {/* Electric glow */}
        <div className="absolute -inset-2 bg-blue-500/20 rounded-3xl blur-xl animate-pulse" />
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 rounded-2xl opacity-60" />
        
        {/* Glass card */}
        <div 
          className="relative bg-slate-900/90 backdrop-blur-xl rounded-2xl overflow-hidden flex flex-col"
          style={{ cursor: isDragging ? 'grabbing' : 'default' }}
        >
          {/* Animated top bar */}
          <div className="h-1 bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-600 animate-pulse" />
          
          {/* Header */}
          <div className="modal-header flex items-center justify-between px-6 py-4 cursor-grab active:cursor-grabbing select-none">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/40">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Image to Video</h2>
                <p className="text-xs text-blue-400">Powered by Veo 2 Fast</p>
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
        <div className="flex-1 p-6 space-y-6 border-t border-blue-500/20">
          {/* Source Image Preview */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-blue-500/20">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Source Image</h3>
            <div className="flex justify-center bg-slate-900/50 rounded-lg overflow-hidden max-h-48">
              {item.src ? (
                <img
                  src={item.src}
                  alt="Source"
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <div className="text-gray-500 p-8">No image selected</div>
              )}
            </div>
          </div>

          {/* Video Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Duration</label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value as 'short' | 'medium' | 'long')}
                className="w-full p-3 bg-slate-800/50 text-white rounded-lg border border-blue-500/30 focus:ring-2 focus:ring-cyan-500 focus:border-transparent focus:outline-none"
              >
                <option value="short">Short (~2s)</option>
                <option value="medium">Medium (~4s)</option>
                <option value="long">Long (~6s)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Aspect Ratio</label>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as '16:9' | '1:1' | '9:16')}
                className="w-full p-3 bg-slate-800/50 text-white rounded-lg border border-blue-500/30 focus:ring-2 focus:ring-cyan-500 focus:border-transparent focus:outline-none"
              >
                <option value="16:9">Landscape (16:9)</option>
                <option value="1:1">Square (1:1)</option>
                <option value="9:16">Portrait (9:16)</option>
              </select>
            </div>
          </div>

          {/* Motion Prompt */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-gray-300">Motion Description</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the motion or animation you want to add to this image..."
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

          {/* Generate Button */}
          <button
            onClick={handleGenerateVideo}
            disabled={!prompt.trim()}
            className="w-full py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed shadow-lg shadow-blue-500/30 transition-all"
          >
            Generate Video
          </button>

          {/* Info */}
          <div className="text-xs text-blue-400/70 text-center">
            Video generation may take 1-2 minutes. The modal will close and your video will appear when ready.
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};