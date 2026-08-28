import React, { useState, useEffect, useMemo } from 'react';
import { BoardItem, PanZoom } from '../types';
import { FileText, Tag, Link as LinkIcon, Hash, Clock, Eye } from './icons';

interface ObsidianNoteComponentProps {
  item: BoardItem;
  panZoom: PanZoom;
  isSelected: boolean;
  isEditing: boolean;
  onDoubleClick: (e: React.MouseEvent) => void;
  onMouseDown: (e: React.MouseEvent, itemId: string) => void;
  onTextChange: (itemId: string, newText: string) => void;
}

// Utility to parse markdown and extract key information
const parseMarkdownContent = (content: string) => {
  const lines = content.split('\n');
  const headings = lines.filter(line => line.startsWith('#'));
  const tags = (content.match(/#[a-zA-Z][\w-]*/g) || [])
    .map(tag => tag.substring(1))
    .filter((tag, index, array) => array.indexOf(tag) === index && tag.length > 1 && !(/^\d+$/.test(tag)))
    .slice(0, 5); // Limit to first 5 valid tags
  const links = (content.match(/\[\[([^\]]+)\]\]/g) || []).slice(0, 3); // First 3 internal links
  const firstParagraph = lines.find(line => line.trim() && !line.startsWith('#'))?.substring(0, 100) + '...';
  
  return {
    title: headings[0]?.replace(/^#+\s*/, '') || 'Untitled',
    headings: headings.slice(0, 3).map(h => h.replace(/^#+\s*/, '')),
    tags,
    links: links.map(link => link.replace(/\[\[|\]\]/g, '')),
    preview: firstParagraph || 'Empty note',
    wordCount: content.split(/\s+/).length
  };
};

// Scale-dependent rendering based on zoom level and item size
const getDisplayMode = (panZoom: PanZoom, item: BoardItem): 'icon' | 'preview' | 'content' | 'detailed' => {
  const effectiveScale = panZoom.k;
  const itemArea = item.width * item.height;
  
  // Optimized thresholds for better content visibility
  if (effectiveScale < 0.2 || itemArea < 5000) return 'icon';
  if (effectiveScale < 0.5 || itemArea < 25000) return 'preview';
  if (effectiveScale < 1.2 || itemArea < 70000) return 'content';
  return 'detailed';
};

// Simple markdown to HTML converter for detailed view
const renderMarkdown = (markdown: string): string => {
  return markdown
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-blue-300 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-blue-200 mb-3">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-blue-100 mb-4">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="italic text-gray-300">$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-gray-700 px-1 rounded text-orange-300">$1</code>')
    .replace(/\[\[(.+?)\]\]/g, '<span class="text-purple-300 underline">$1</span>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 text-gray-200">• $1</li>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');
};

export const ObsidianNoteComponent: React.FC<ObsidianNoteComponentProps> = ({
  item,
  panZoom,
  isSelected,
  isEditing,
  onDoubleClick,
  onMouseDown,
  onTextChange,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const obsidianData = item.obsidianData;
  const displayMode = getDisplayMode(panZoom, item);
  
  const parsedContent = useMemo(() => {
    if (!obsidianData?.markdownContent) return null;
    return parseMarkdownContent(obsidianData.markdownContent);
  }, [obsidianData?.markdownContent]);

  if (!obsidianData || !parsedContent) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-red-900/20 border border-red-500 rounded">
        <span className="text-red-400 text-sm">Invalid Obsidian Note</span>
      </div>
    );
  }

  // Icon view - very small scale or tiny items
  if (displayMode === 'icon') {
    return (
      <div
        className={`w-full h-full flex items-center justify-center bg-purple-900/30 border-2 rounded cursor-pointer transition-all ${
          isSelected ? 'border-purple-400 shadow-lg' : 'border-purple-600/50'
        } ${isHovered ? 'bg-purple-800/40' : ''}`}
        onMouseDown={(e) => onMouseDown(e, item.id)}
        onDoubleClick={onDoubleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        title={`${parsedContent.title} (${obsidianData.wordCount} words)`}
      >
        <FileText className="text-purple-300" size={Math.min(item.width * 0.6, item.height * 0.6, 48)} />
      </div>
    );
  }

  // Preview view - show title and basic info
  if (displayMode === 'preview') {
    return (
      <div
        className={`w-full h-full p-3 bg-gradient-to-br from-purple-900/20 to-indigo-900/20 border-2 rounded-lg cursor-pointer transition-all ${
          isSelected ? 'border-purple-400 shadow-lg' : 'border-purple-600/50'
        } ${isHovered ? 'bg-purple-800/30' : ''}`}
        onMouseDown={(e) => onMouseDown(e, item.id)}
        onDoubleClick={onDoubleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex items-start space-x-2 mb-2">
          <FileText className="text-purple-400 flex-shrink-0 mt-1" size={16} />
          <h3 className="font-semibold text-purple-200 text-sm leading-tight truncate">
            {parsedContent.title}
          </h3>
        </div>
        
        <div className="text-xs text-gray-300 leading-relaxed mb-2">
          <p className="line-clamp-3 mb-1">{parsedContent.preview}</p>
          {parsedContent.headings.length > 0 && (
            <div className="text-blue-300 text-xs font-medium">
              Topics: {parsedContent.headings.slice(0, 2).join(', ')}
              {parsedContent.headings.length > 2 && ` +${parsedContent.headings.length - 2} more`}
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span className="flex items-center space-x-1">
            <Hash size={10} />
            <span>{obsidianData.wordCount}w</span>
          </span>
          {parsedContent.tags.length > 0 && (
            <div className="flex space-x-1">
              {parsedContent.tags.slice(0, 2).map((tag, i) => (
                <span key={i} className="bg-purple-800/50 px-1 rounded text-xs">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Content view - show structured content
  if (displayMode === 'content') {
    return (
      <div
        className={`w-full h-full p-4 bg-gradient-to-br from-purple-900/20 to-indigo-900/20 border-2 rounded-lg cursor-pointer transition-all overflow-hidden flex flex-col ${
          isSelected ? 'border-purple-400 shadow-lg' : 'border-purple-600/50'
        } ${isHovered ? 'bg-purple-800/20' : ''}`}
        onMouseDown={(e) => onMouseDown(e, item.id)}
        onDoubleClick={onDoubleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start space-x-2 flex-1">
            <FileText className="text-purple-400 flex-shrink-0 mt-1" size={20} />
            <div>
              <h2 className="font-bold text-purple-100 text-base leading-tight">
                {parsedContent.title}
              </h2>
              <div className="flex items-center space-x-3 mt-1 text-xs text-gray-400">
                <span className="flex items-center space-x-1">
                  <Clock size={12} />
                  <span>{new Date(obsidianData.lastModified).toLocaleDateString()}</span>
                </span>
                <span>{obsidianData.wordCount} words</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tags */}
        {parsedContent.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {parsedContent.tags.map((tag, i) => (
              <span key={i} className="flex items-center space-x-1 bg-purple-800/50 text-purple-200 px-2 py-1 rounded text-xs">
                <Tag size={10} />
                <span>{tag}</span>
              </span>
            ))}
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto text-sm text-gray-200 leading-relaxed relative" style={{ scrollbarWidth: 'thin', scrollbarColor: '#6366f1 transparent' }}>
          {parsedContent.headings.length > 0 && (
            <div className="mb-3 pb-2 border-b border-gray-700/50 sticky top-0 bg-gradient-to-br from-purple-900/20 to-indigo-900/20">
              {parsedContent.headings.map((heading, i) => (
                <div key={i} className="text-blue-300 font-semibold mb-1 text-base">
                  • {heading}
                </div>
              ))}
            </div>
          )}
          <div className="text-gray-300 leading-relaxed pr-2">
            <div 
              dangerouslySetInnerHTML={{ __html: renderMarkdown(obsidianData.markdownContent) }}
            />
          </div>
          {/* Scroll indicator */}
          <div className="absolute top-2 right-2 text-xs text-gray-500 bg-black/30 px-2 py-1 rounded">
            ↕ Scroll
          </div>
        </div>

        {/* Links */}
        {parsedContent.links.length > 0 && (
          <div className="border-t border-gray-700 pt-2">
            <div className="flex items-center space-x-1 text-xs text-gray-400 mb-1">
              <LinkIcon size={12} />
              <span>Links:</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {parsedContent.links.map((link, i) => (
                <span key={i} className="text-purple-300 text-xs underline">
                  {link}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Detailed view - full markdown rendering
  return (
    <div
      className={`w-full h-full p-6 bg-gradient-to-br from-purple-900/20 to-indigo-900/20 border-2 rounded-lg cursor-pointer transition-all overflow-y-auto flex flex-col ${
        isSelected ? 'border-purple-400 shadow-lg' : 'border-purple-600/50'
      } ${isHovered ? 'bg-purple-800/20' : ''}`}
      onMouseDown={(e) => onMouseDown(e, item.id)}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ scrollbarWidth: 'thin', scrollbarColor: '#6366f1 transparent' }}
    >
      {/* Scrollable Full Content */}
      <div className="flex-1 overflow-y-auto">
        <div 
          className="prose prose-invert prose-sm max-w-none pr-2"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(obsidianData.markdownContent) }}
        />
      </div>
      
      {/* Metadata footer - sticky */}
      <div className="border-t border-gray-700 pt-3 mt-4 text-xs text-gray-400 bg-gradient-to-br from-purple-900/20 to-indigo-900/20">
        <div className="flex items-center justify-between">
          <span>{obsidianData.fileName}</span>
          <span>{new Date(obsidianData.lastModified).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};

export default ObsidianNoteComponent;