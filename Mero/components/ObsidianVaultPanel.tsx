import React, { useState, useEffect, useRef } from 'react';
import { ItemType, BoardItem } from '../types';
import { FolderOpen, FileText, Search, RefreshCw, Filter, Tag, Calendar, Hash } from './icons';

interface ObsidianFile {
  name: string;
  path: string;
  content: string;
  lastModified: number;
  size: number;
  tags: string[];
  links: string[];
  wordCount: number;
}

interface ObsidianVaultPanelProps {
  onAddItem: (type: ItemType, options?: Partial<BoardItem>) => void;
  isOpen: boolean;
  onClose: () => void;
}

const VAULT_PATH_STORAGE_KEY = 'obsidian-vault-path';
const VAULT_HANDLE_STORAGE_KEY = 'obsidian-vault-handle';

export const ObsidianVaultPanel: React.FC<ObsidianVaultPanelProps> = ({
  onAddItem,
  isOpen,
  onClose,
}) => {
  const [vaultPath, setVaultPath] = useState<string>(() => {
    return localStorage.getItem(VAULT_PATH_STORAGE_KEY) || '';
  });
  const [files, setFiles] = useState<ObsidianFile[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<ObsidianFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('name');
  const [error, setError] = useState<string | null>(null);
  const [storedVaultHandle, setStoredVaultHandle] = useState<any>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  
  // Extract unique tags from all files
  const allTags = Array.from(new Set<string>(files.flatMap((file) => file.tags || [])));

  // Try to load saved vault on modal open, but don't auto-trigger picker
  useEffect(() => {
    if (isOpen && vaultPath && files.length === 0) {
      // If we have a saved path but no files, show the connect button
      // Don't auto-trigger picker due to user activation requirements
    }
  }, [isOpen, vaultPath]);

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
  
  // Connect to Obsidian vault
  const connectToVault = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      if ('showDirectoryPicker' in window) {
        // Modern File System Access API
        const dirHandle = await (window as any).showDirectoryPicker({
          id: 'obsidian-vault',
          mode: 'read',
          startIn: 'documents'
        });
        
        const vaultFiles = await readVaultDirectory(dirHandle);
        setFiles(vaultFiles);
        setVaultPath(dirHandle.name);
        
        // Save to localStorage for persistence
        localStorage.setItem(VAULT_PATH_STORAGE_KEY, dirHandle.name);
      } else {
        // Fallback: trigger file input for multiple markdown files
        fileInputRef.current?.click();
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError('Failed to access vault: ' + err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // Read vault directory recursively
  const readVaultDirectory = async (dirHandle: any): Promise<ObsidianFile[]> => {
    const vaultFiles: ObsidianFile[] = [];
    
    try {
      if (!dirHandle || typeof dirHandle.entries !== 'function') {
        throw new Error('Invalid directory handle');
      }

      for await (const [name, handle] of dirHandle.entries()) {
        if (!name || !handle) continue;
        
        if (handle.kind === 'file' && name.endsWith('.md')) {
          try {
            const file = await handle.getFile();
            if (!file) continue;
            
            const content = await file.text();
            const parsedFile = parseObsidianFile(name, content, file.lastModified || Date.now());
            if (parsedFile) {
              vaultFiles.push(parsedFile);
            }
          } catch (err) {
            console.warn(`Failed to read file ${name}:`, err);
          }
        } else if (handle.kind === 'directory' && !name.startsWith('.') && !name.startsWith('node_modules')) {
          try {
            // Recursively read subdirectories, but skip hidden folders and common non-vault folders
            const subFiles = await readVaultDirectory(handle);
            if (subFiles && Array.isArray(subFiles)) {
              vaultFiles.push(...subFiles);
            }
          } catch (err) {
            console.warn(`Failed to read directory ${name}:`, err);
          }
        }
      }
    } catch (err) {
      console.error('Error reading vault directory:', err);
      throw err;
    }
    
    return vaultFiles;
  };
  
  // Parse Obsidian markdown file
  const parseObsidianFile = (fileName: string, content: string, lastModified: number): ObsidianFile | null => {
    try {
      if (!fileName || typeof content !== 'string') {
        console.warn('Invalid file data:', { fileName, content: typeof content });
        return null;
      }

      const safeContent = content || '';
      
      const tags = (safeContent.match(/#[a-zA-Z][\w-]*/g) || [])
        .map(tag => tag.substring(1))
        .filter((tag, index, array) => array.indexOf(tag) === index && tag.length > 1 && !(/^\d+$/.test(tag)));
      
      const links = (safeContent.match(/\[\[([^\]]+)\]\]/g) || [])
        .map(link => link.replace(/\[\[|\]\]/g, ''))
        .filter((link, index, array) => array.indexOf(link) === index);
      
      const wordCount = safeContent.split(/\s+/).filter(word => word && word.length > 0).length;
      
      return {
        name: fileName,
        path: fileName, // In a real implementation, this would be the full path
        content: safeContent,
        lastModified: lastModified || Date.now(),
        size: safeContent.length,
        tags: tags || [],
        links: links || [],
        wordCount: wordCount || 0,
      };
    } catch (err) {
      console.error('Error parsing Obsidian file:', err);
      return null;
    }
  };
  
  // Handle file input fallback
  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles: File[] = event.target.files ? Array.from(event.target.files) : [];
    const markdownFiles = selectedFiles.filter(file => file.name.endsWith('.md'));
    
    if (markdownFiles.length === 0) {
      setError('No markdown files selected');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    Promise.all(
      markdownFiles.map(file => 
        file.text().then(content => parseObsidianFile(file.name, content, file.lastModified))
      )
    ).then(vaultFiles => {
      setFiles(vaultFiles);
      setVaultPath('Selected Files');
    }).catch(err => {
      setError('Failed to read files: ' + err.message);
    }).finally(() => {
      setIsLoading(false);
    });
  };
  
  // Filter and sort files
  useEffect(() => {
    try {
      let filtered = files.filter(file => file && file.name); // Only include valid files
      
      // Apply search filter
      if (searchQuery && searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(file => {
          try {
            return (
              (file.name || '').toLowerCase().includes(query) ||
              (file.content || '').toLowerCase().includes(query) ||
              (file.tags || []).some(tag => (tag || '').toLowerCase().includes(query))
            );
          } catch (err) {
            console.warn('Error filtering file:', file, err);
            return false;
          }
        });
      }
      
      // Apply tag filter
      if (selectedTags && selectedTags.length > 0) {
        filtered = filtered.filter(file => {
          try {
            return selectedTags.some(tag => (file.tags || []).includes(tag));
          } catch (err) {
            console.warn('Error filtering by tags:', file, err);
            return false;
          }
        });
      }
      
      // Sort files
      filtered.sort((a, b) => {
        try {
          switch (sortBy) {
            case 'name':
              return (a.name || '').localeCompare(b.name || '');
            case 'date':
              return (b.lastModified || 0) - (a.lastModified || 0);
            case 'size':
              return (b.wordCount || 0) - (a.wordCount || 0);
            default:
              return 0;
          }
        } catch (err) {
          console.warn('Error sorting files:', err);
          return 0;
        }
      });
      
      setFilteredFiles(filtered || []);
    } catch (err) {
      console.error('Error in filtering/sorting files:', err);
      setFilteredFiles([]);
    }
  }, [files, searchQuery, selectedTags, sortBy]);
  
  // Add file to canvas as ObsidianNote item
  const addFileToCanvas = (file: ObsidianFile) => {
    try {
      if (!file || !file.name) {
        console.warn('Invalid file for canvas:', file);
        return;
      }

      onAddItem(ItemType.ObsidianNote, {
        text: (file.name || 'Untitled').replace('.md', ''),
        width: 300,
        height: 400,
        backgroundColor: 'transparent',
        obsidianData: {
          filePath: file.path || file.name,
          fileName: file.name,
          markdownContent: file.content || '',
          lastModified: file.lastModified || Date.now(),
          tags: file.tags || [],
          links: file.links || [],
          wordCount: file.wordCount || 0,
        },
        scaleThresholds: {
          preview: 0.3,
          content: 0.8,
          detailed: 1.5,
        },
      });
      
      // Auto-close the finder after adding file to canvas
      onClose();
    } catch (err) {
      console.error('Error adding file to canvas:', err);
      setError('Failed to add file to canvas: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };
  
  // Toggle tag filter
  const toggleTagFilter = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div 
        ref={modalRef}
        className="bg-gray-800/90 rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col border border-gray-700/50"
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`,
          cursor: isDragging ? 'grabbing' : 'default'
        }}
        onClick={e => e.stopPropagation()}
        onMouseDown={handleMouseDown}
      >
        {/* Header */}
        <div className="modal-header flex items-center justify-between p-6 border-b border-gray-700/50 cursor-grab active:cursor-grabbing select-none">
          <div className="flex items-center space-x-3">
            <FolderOpen className="text-purple-400" size={24} />
            <div>
              <h2 className="text-xl font-bold text-white">Select Obsidian Note</h2>
              {vaultPath && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-400">{vaultPath} • {files.length} notes</p>
                  <button
                    onClick={connectToVault}
                    className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    Change Vault
                  </button>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>
        
        {/* Controls */}
        <div className="p-4 border-b border-gray-700/50 space-y-4">
          {/* Connect to Vault Button */}
          {!vaultPath && !isLoading && (
            <div className="text-center py-8">
              <FolderOpen className="mx-auto mb-4 text-purple-400" size={48} />
              <h3 className="text-lg font-semibold text-white mb-2">Select Your Obsidian Vault</h3>
              <p className="text-gray-400 mb-4">Choose your vault folder to browse and select notes</p>
              <button
                onClick={connectToVault}
                className="inline-flex items-center space-x-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-semibold shadow-lg hover:shadow-xl"
              >
                <FolderOpen size={20} />
                <span>Browse for Vault Folder</span>
              </button>
            </div>
          )}
          
          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center space-x-2 py-8">
              <RefreshCw className="animate-spin" size={24} />
              <span className="text-gray-300 text-lg">Loading Obsidian Vault...</span>
            </div>
          )}
          
          {/* Search and filters */}
          {vaultPath && !isLoading && (
            <div className="flex flex-col space-y-3">
              <div className="flex items-center space-x-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search notes, content, or tags..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'name' | 'date' | 'size')}
                  className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="name">Sort by Name</option>
                  <option value="date">Sort by Date</option>
                  <option value="size">Sort by Size</option>
                </select>
              </div>
              
              {/* Tag filters */}
              {allTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {allTags.slice(0, 10).map(tag => (
                    <button
                      key={tag}
                      onClick={() => toggleTagFilter(tag)}
                      className={`flex items-center space-x-1 px-2 py-1 text-xs rounded-full transition-colors ${
                        selectedTags.includes(tag)
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      <Tag size={12} />
                      <span>{tag}</span>
                    </button>
                  ))}
                  {allTags.length > 10 && (
                    <span className="px-2 py-1 text-xs text-gray-400">
                      +{allTags.length - 10} more
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Error display */}
        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-900/50 border border-red-700 text-red-200 rounded-lg">
            {error}
          </div>
        )}
        
        {/* File list */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <FileText size={48} className="mb-4 opacity-50" />
              <p className="text-lg">
                {isLoading ? 'Loading notes from vault...' : 
                 files.length === 0 ? 'No markdown files found in vault' : 
                 'No notes match your search'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredFiles.map((file, index) => (
                <div key={index} className="bg-gray-700/50 rounded-lg p-4 hover:bg-gray-700/70 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start space-x-2 flex-1">
                      <FileText className="text-purple-400 flex-shrink-0 mt-1" size={16} />
                      <div>
                        <h3 className="font-semibold text-white text-sm">
                          {file.name.replace('.md', '')}
                        </h3>
                        <div className="flex items-center space-x-3 mt-1 text-xs text-gray-400">
                          <span className="flex items-center space-x-1">
                            <Calendar size={12} />
                            <span>{new Date(file.lastModified).toLocaleDateString()}</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <Hash size={12} />
                            <span>{file.wordCount}w</span>
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => addFileToCanvas(file)}
                      className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded transition-colors hover:shadow-lg"
                    >
                      ✓ Select
                    </button>
                  </div>
                  
                  {/* Preview */}
                  <p className="text-xs text-gray-300 leading-relaxed line-clamp-2 mb-2">
                    {file.content.substring(0, 120)}...
                  </p>
                  
                  {/* Tags */}
                  {file.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {file.tags.slice(0, 3).map((tag, tagIndex) => (
                        <span key={tagIndex} className="bg-purple-800/50 text-purple-200 px-1 py-0.5 rounded text-xs">
                          #{tag}
                        </span>
                      ))}
                      {file.tags.length > 3 && (
                        <span className="text-gray-400 text-xs">+{file.tags.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Hidden file input for fallback */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".md"
          onChange={handleFileInput}
          className="hidden"
        />
      </div>
    </div>
  );
};

export default ObsidianVaultPanel;