import React, { useState } from 'react';
import { useBoardManager } from '../hooks/useBoardManager';
import { TrashIcon } from './icons';

interface BoardManagerProps {
  onSwitchBoard?: (boardId: string) => void;
  onClose?: () => void;
}

// Format date to relative time
const formatRelativeTime = (date: Date | number | undefined): string => {
  if (!date) return '';
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString();
};

// Board card component
const BoardCard: React.FC<{
  board: any;
  isActive: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
}> = ({ board, isActive, onSelect, onDelete }) => (
  <div
    onClick={onSelect}
    className={`
      group relative p-4 rounded-xl cursor-pointer transition-all duration-200
      ${isActive 
        ? 'bg-gradient-to-br from-blue-600/80 to-cyan-600/80 ring-2 ring-cyan-400/50 shadow-lg shadow-blue-500/30' 
        : 'bg-slate-800/50 hover:bg-slate-700/50 border border-blue-500/20 hover:border-cyan-500/40'
      }
    `}
  >
    {/* Board Preview Placeholder */}
    <div className={`
      w-full h-24 rounded-lg mb-3 flex items-center justify-center
      ${isActive ? 'bg-blue-500/30' : 'bg-slate-900/50'}
    `}>
      <svg className={`w-8 h-8 ${isActive ? 'text-cyan-200' : 'text-blue-400/50'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
      </svg>
    </div>
    
    {/* Board Info */}
    <div className="flex items-start justify-between gap-2">
      <div className="flex-1 min-w-0">
        <h3 className={`font-medium truncate ${isActive ? 'text-white' : 'text-gray-200'}`}>
          {board.name}
        </h3>
        <p className={`text-xs mt-0.5 ${isActive ? 'text-cyan-200' : 'text-blue-400/70'}`}>
          {formatRelativeTime(board.updatedAt || board.createdAt)}
        </p>
      </div>
      
      {/* Delete Button */}
      <button
        onClick={onDelete}
        className={`
          p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all
          ${isActive 
            ? 'hover:bg-blue-500/50 text-cyan-200' 
            : 'hover:bg-red-600/80 text-gray-400 hover:text-white'
          }
        `}
        title="Delete board"
      >
        <TrashIcon />
      </button>
    </div>
    
    {/* Active Indicator */}
    {isActive && (
      <div className="absolute top-2 right-2">
        <span className="flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-300 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-200"></span>
        </span>
      </div>
    )}
  </div>
);

export const BoardManager: React.FC<BoardManagerProps> = ({ onSwitchBoard, onClose }) => {
  const {
    boards,
    currentBoard,
    isLoading,
    error,
    switchBoard,
    createBoard,
    deleteBoard,
  } = useBoardManager();

  const [isCreating, setIsCreating] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoardName.trim()) return;
    
    try {
      const board = await createBoard({ name: newBoardName.trim() });
      await switchBoard(board.boardId);
      if (onSwitchBoard) {
        onSwitchBoard(board.boardId);
      }
      setNewBoardName('');
      setIsCreating(false);
      if (onClose) onClose();
    } catch (error) {
      console.error('Failed to create board:', error);
    }
  };

  const handleSelectBoard = async (boardId: string) => {
    await switchBoard(boardId);
    if (onSwitchBoard) {
      onSwitchBoard(boardId);
    }
    if (onClose) onClose();
  };

  const handleDeleteBoard = async (boardId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this board?')) return;
    
    try {
      await deleteBoard(boardId);
    } catch (error) {
      console.error('Failed to delete board:', error);
    }
  };

  // Filter boards by search query
  const filteredBoards = boards.filter(board => 
    board.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3"></div>
          <p className="text-gray-400 text-sm">Loading boards...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <div className="text-red-400 mb-2">Failed to load boards</div>
        <p className="text-gray-500 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-h-[70vh]">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/40">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Your Boards</h2>
              <p className="text-xs text-blue-400">{boards.length} board{boards.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-sm font-semibold rounded-lg transition-all shadow-lg shadow-blue-500/30 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Board
          </button>
        </div>
        
        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search boards..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-blue-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
          />
        </div>
      </div>

      {/* Board Grid */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 border-t border-blue-500/20">
        {filteredBoards.length === 0 ? (
          <div className="text-center py-12">
            {searchQuery ? (
              <>
                <svg className="w-12 h-12 text-blue-400/30 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p className="text-gray-400">No boards match "{searchQuery}"</p>
              </>
            ) : (
              <>
                <svg className="w-12 h-12 text-blue-400/30 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <p className="text-gray-400 mb-4">No boards yet</p>
                <button
                  onClick={() => setIsCreating(true)}
                  className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-sm font-semibold rounded-lg transition-all shadow-lg shadow-blue-500/30"
                >
                  Create your first board
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {filteredBoards.map(board => (
              <BoardCard
                key={board.boardId}
                board={board}
                isActive={currentBoard?.boardId === board.boardId}
                onSelect={() => handleSelectBoard(board.boardId)}
                onDelete={(e) => handleDeleteBoard(board.boardId, e)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Board Inline Form */}
      {isCreating && (
        <div className="border-t border-blue-500/20 px-6 py-4 bg-slate-800/50">
          <form onSubmit={handleCreateBoard} className="flex gap-3">
            <input
              type="text"
              value={newBoardName}
              onChange={(e) => setNewBoardName(e.target.value)}
              placeholder="Enter board name..."
              className="flex-1 px-4 py-2.5 bg-slate-900/50 border border-blue-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
              autoFocus
            />
            <button
              type="submit"
              disabled={!newBoardName.trim()}
              className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-all shadow-lg shadow-blue-500/30"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setNewBoardName('');
              }}
              className="px-4 py-2.5 text-gray-400 hover:text-white text-sm font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
          </form>
        </div>
      )}
    </div>
  );
};