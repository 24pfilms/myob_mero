import React, { useState, useRef, useEffect } from 'react';
import { BoardItem } from '../types';

interface InlineMarkupPromptProps {
  item: BoardItem;
  x: number;
  y: number;
  onClose: () => void;
  onApply: (itemId: string, newImageUrl: string, prompt: string, originalUrl?: string, newDimensions?: { width: number; height: number }) => void;
  onClearDrawing: (itemId: string) => void;
  onStartEditing?: (itemId: string) => void;
  onStopEditing?: (itemId: string) => void;
}

export const InlineMarkupPrompt: React.FC<InlineMarkupPromptProps> = ({
  item,
  x,
  y,
  onClose,
  onApply,
  onClearDrawing,
  onStartEditing,
  onStopEditing,
}) => {
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = () => {
    if (!prompt.trim() || isProcessing) return;
    alert('AI image editing is unavailable until a server-side provider is configured.');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed z-[100001] bg-slate-900/95 backdrop-blur-xl rounded-xl shadow-2xl border border-blue-500/30 p-3 w-72"
      style={{ 
        top: y, 
        left: x,
        boxShadow: '0 0 20px rgba(59, 130, 246, 0.3), 0 4px 20px rgba(0, 0, 0, 0.5)'
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        <span className="text-xs font-medium text-gray-300">Markup detected</span>
      </div>

      {/* Prompt input */}
      <input
        ref={inputRef}
        type="text"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="What should I change?"
        disabled={isProcessing}
        className="w-full px-3 py-2 bg-slate-800/80 text-white text-sm rounded-lg border border-blue-500/30 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none placeholder-gray-500 disabled:opacity-50"
      />

      {/* Buttons */}
      <div className="flex gap-2 mt-2">
        <button
          onClick={onClose}
          disabled={isProcessing}
          className="flex-1 px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!prompt.trim() || isProcessing}
          className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <span className="flex items-center justify-center gap-1">
              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Processing
            </span>
          ) : (
            'Apply'
          )}
        </button>
      </div>

      {/* Hint */}
      <p className="text-[10px] text-gray-500 mt-2 text-center">
        Press Enter to apply • Esc to cancel
      </p>
    </div>
  );
};
