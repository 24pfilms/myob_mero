import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText,
  Folder,
  FolderOpen,
  Plus,
  Search,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  Trash2,
  FolderPlus,
  CheckSquare,
  Square,
  Settings,
  Image as ImageIcon,
  ArrowUpDown,
  ArrowUpAZ,
  ArrowDownAZ,
  Clock,
  CalendarClock,
  Upload,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type SortOption = 'name-asc' | 'name-desc' | 'created-new' | 'created-old' | 'modified-new' | 'modified-old';

interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  createdAt?: string;
  modifiedAt?: string;
}

interface FileBrowserProps {
  files: FileNode[];
  activeFileId?: string;
  onFileSelect: (fileId: string) => void;
  onFileCreate: () => void;
  onFolderCreate: () => void;
  onFileDelete: (fileId: string) => void;
  onFileMoveToFolder: (fileId: string, folderId: string) => void;
  onSettingsClick: () => void;
  onImagesGalleryClick?: () => void;
  imageCount?: number;
  sortOption?: SortOption;
  onSortChange?: (sortOption: SortOption) => void;
  sidebarFontSize?: number;
  onExternalFilesImport?: (files: File[], targetFolderId?: string | null) => Promise<void>;
  onInvalidFileDrop?: (fileNames: string[]) => void;
  isImporting?: boolean;
  onVaultImportClick?: () => void;
}

// Helper functions for external file drop detection
const isExternalFileDrop = (e: React.DragEvent): boolean => {
  // External files have 'Files' in dataTransfer.types
  // Internal drags set custom 'text/plain' data with JSON
  const hasFiles = e.dataTransfer.types.includes('Files');
  // For dragover, we can't access getData, so check types
  const hasInternalData = e.dataTransfer.types.includes('text/plain');
  // If we have files and the drag is from outside, it's external
  return hasFiles && e.dataTransfer.files.length > 0;
};

const validateMdFiles = (files: FileList): File[] => {
  return Array.from(files).filter(file =>
    file.name.toLowerCase().endsWith('.md')
  );
};

const FileTreeItem = ({
  node,
  level = 0,
  activeFileId,
  selectedFiles,
  onFileSelect,
  onFileDelete,
  onFileMoveToFolder,
  onFileClick,
  fontSize = 13,
  onExternalFilesImport,
  onInvalidFileDrop,
}: {
  node: FileNode;
  level?: number;
  activeFileId?: string;
  selectedFiles: Set<string>;
  onFileSelect: (id: string) => void;
  onFileDelete: (id: string) => void;
  onFileMoveToFolder: (fileId: string, folderId: string) => void;
  onFileClick: (id: string, isShiftClick: boolean) => void;
  fontSize?: number;
  onExternalFilesImport?: (files: File[], folderId: string) => Promise<void>;
  onInvalidFileDrop?: (fileNames: string[]) => void;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const isActive = node.id === activeFileId;
  const isSelected = selectedFiles.has(node.id);
  const isFolder = node.type === 'folder';

  const handleDragStart = (e: React.DragEvent) => {
    if (isFolder) {
      e.preventDefault();
      return;
    }
    // If dragging a selected file, include all selected files
    if (isSelected && selectedFiles.size > 1) {
      e.dataTransfer.setData('text/plain', JSON.stringify(Array.from(selectedFiles)));
    } else {
      e.dataTransfer.setData('text/plain', JSON.stringify([node.id]));
    }
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!isFolder) return;
    e.preventDefault();
    // Check if this is an external file drop or internal move
    if (e.dataTransfer.types.includes('Files')) {
      e.dataTransfer.dropEffect = 'copy';
    } else {
      e.dataTransfer.dropEffect = 'move';
    }
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!isFolder) return;
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    if (!isFolder) return;
    e.preventDefault();
    e.stopPropagation();

    // Check for external file drop first
    if (e.dataTransfer.files.length > 0) {
      const allFiles = Array.from(e.dataTransfer.files);
      const mdFiles = validateMdFiles(e.dataTransfer.files);

      if (mdFiles.length > 0 && onExternalFilesImport) {
        await onExternalFilesImport(mdFiles, node.id);
        setIsDragOver(false);
        return;
      } else if (allFiles.length > 0 && mdFiles.length === 0 && onInvalidFileDrop) {
        // All dropped files were non-.md
        onInvalidFileDrop(allFiles.map(f => f.name));
        setIsDragOver(false);
        return;
      }
    }

    // Handle internal file move
    const data = e.dataTransfer.getData('text/plain');
    if (data) {
      try {
        const fileIds = JSON.parse(data) as string[];
        // Move all selected files to this folder
        fileIds.forEach(fileId => {
          if (fileId !== node.id) {
            onFileMoveToFolder(fileId, node.id);
          }
        });
      } catch {
        // Fallback for old format
        if (data !== node.id) {
          onFileMoveToFolder(data, node.id);
        }
      }
    }
    setIsDragOver(false);
  };

  return (
    <div>
      <div
        className={`
          flex items-center gap-2 px-3 py-1 hover:bg-sidebar-accent/60 rounded-lg cursor-pointer group transition-all duration-200 hover:shadow-sm
          ${isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm border border-sidebar-border/50' : ''}
          ${isSelected && !isFolder ? 'bg-violet-500/10 border border-violet-500/50 shadow-sm' : ''}
          ${isDragOver ? 'bg-primary/20 border-2 border-primary/50 border-dashed' : ''}
        `}
        style={{ paddingLeft: `${level * 12 + 12}px` }}
        draggable={!isFolder}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={(e) => {
          e.stopPropagation(); // Prevent click from bubbling to container
          if (isFolder) {
            setIsExpanded(!isExpanded);
          } else {
            console.log('Click:', { ctrl: e.ctrlKey, shift: e.shiftKey, meta: e.metaKey });
            // If Ctrl or Shift is held, handle selection
            if (e.ctrlKey || e.shiftKey || e.metaKey) {
              onFileClick(node.id, e.shiftKey);
            } else {
              // Normal click: just open the file
              onFileSelect(node.id);
            }
          }
        }}
      >
        {!isFolder && isSelected && (
          <CheckSquare className="w-4 h-4 text-violet-500" />
        )}
        
        {isFolder && (
          <span className="text-muted-foreground">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </span>
        )}
        
        {isFolder ? (
          isExpanded ? (
            <FolderOpen className="w-4 h-4 text-primary" />
          ) : (
            <Folder className="w-4 h-4 text-primary" />
          )
        ) : (
          <FileText className="w-4 h-4 text-muted-foreground" />
        )}
        
        <span className="flex-1 truncate" style={{ fontSize: `${fontSize}px` }}>{node.name}</span>
        
        {!isFolder && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onFileDelete(node.id);
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      
      {isFolder && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeItem
              key={child.id}
              node={child}
              level={level + 1}
              activeFileId={activeFileId}
              selectedFiles={selectedFiles}
              onFileSelect={onFileSelect}
              onFileDelete={onFileDelete}
              onFileMoveToFolder={onFileMoveToFolder}
              onFileClick={onFileClick}
              fontSize={fontSize}
              onExternalFilesImport={onExternalFilesImport}
              onInvalidFileDrop={onInvalidFileDrop}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const FileBrowser = ({
  files,
  activeFileId,
  onFileSelect,
  onFileCreate,
  onFolderCreate,
  onFileDelete,
  onFileMoveToFolder,
  onSettingsClick,
  onImagesGalleryClick,
  imageCount = 0,
  sortOption = 'name-asc',
  onSortChange,
  sidebarFontSize = 13,
  onExternalFilesImport,
  onInvalidFileDrop,
  isImporting = false,
  onVaultImportClick,
}: FileBrowserProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [lastClickedFile, setLastClickedFile] = useState<string | null>(null);
  const [isExternalDragOver, setIsExternalDragOver] = useState(false);

  // Handle external file drop on sidebar (root level)
  const handleSidebarDragOver = (e: React.DragEvent) => {
    // Only handle if it's an external file drop
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
      setIsExternalDragOver(true);
    }
  };

  const handleSidebarDragLeave = (e: React.DragEvent) => {
    // Only reset if leaving the sidebar container entirely
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      setIsExternalDragOver(false);
    }
  };

  const handleSidebarDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsExternalDragOver(false);

    if (e.dataTransfer.files.length > 0) {
      const allFiles = Array.from(e.dataTransfer.files);
      const mdFiles = validateMdFiles(e.dataTransfer.files);

      if (mdFiles.length > 0 && onExternalFilesImport) {
        await onExternalFilesImport(mdFiles, null); // null = root level
      } else if (allFiles.length > 0 && mdFiles.length === 0 && onInvalidFileDrop) {
        // All dropped files were non-.md
        onInvalidFileDrop(allFiles.map(f => f.name));
      }
    }
  };
  
  // Get flat list of all files for shift-select range
  const getFlatFileList = (nodes: FileNode[]): string[] => {
    const result: string[] = [];
    const traverse = (nodes: FileNode[]) => {
      nodes.forEach(node => {
        if (node.type === 'file') {
          result.push(node.id);
        }
        if (node.children) {
          traverse(node.children);
        }
      });
    };
    traverse(nodes);
    return result;
  };
  
  const handleFileClick = (fileId: string, isShiftClick: boolean) => {
    if (isShiftClick && lastClickedFile) {
      // Shift+click: Select range
      const flatList = getFlatFileList(files);
      const startIndex = flatList.indexOf(lastClickedFile);
      const endIndex = flatList.indexOf(fileId);
      
      if (startIndex !== -1 && endIndex !== -1) {
        const [start, end] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
        const rangeFiles = flatList.slice(start, end + 1);
        setSelectedFiles(new Set(rangeFiles));
      }
    } else {
      // Regular click: Toggle single selection
      const newSelected = new Set(selectedFiles);
      if (newSelected.has(fileId)) {
        newSelected.delete(fileId);
      } else {
        newSelected.add(fileId);
      }
      setSelectedFiles(newSelected);
      setLastClickedFile(fileId);
    }
  };

  // Sort files based on sort option
  const sortNodes = (nodes: FileNode[], option: SortOption): FileNode[] => {
    const sorted = [...nodes];
    
    sorted.sort((a, b) => {
      // Always keep folders before files
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      
      // For files, apply the selected sort
      if (a.type === 'file' && b.type === 'file') {
        switch (option) {
          case 'name-asc':
            return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
          case 'name-desc':
            return b.name.localeCompare(a.name, undefined, { sensitivity: 'base' });
          case 'created-new':
            // If timestamps are missing, fall back to name sorting
            if (!a.createdAt && !b.createdAt) {
              return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
            }
            if (!a.createdAt) return 1; // Put items without timestamp at the end
            if (!b.createdAt) return -1;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          case 'created-old':
            // If timestamps are missing, fall back to name sorting
            if (!a.createdAt && !b.createdAt) {
              return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
            }
            if (!a.createdAt) return 1; // Put items without timestamp at the end
            if (!b.createdAt) return -1;
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          case 'modified-new':
            // If timestamps are missing, fall back to name sorting
            if (!a.modifiedAt && !b.modifiedAt) {
              return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
            }
            if (!a.modifiedAt) return 1; // Put items without timestamp at the end
            if (!b.modifiedAt) return -1;
            return new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime();
          case 'modified-old':
            // If timestamps are missing, fall back to name sorting
            if (!a.modifiedAt && !b.modifiedAt) {
              return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
            }
            if (!a.modifiedAt) return 1; // Put items without timestamp at the end
            if (!b.modifiedAt) return -1;
            return new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime();
          default:
            return 0;
        }
      }
      
      // For folders, always sort alphabetically
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
    
    // Recursively sort children in folders
    return sorted.map(node => {
      if (node.children && node.children.length > 0) {
        return {
          ...node,
          children: sortNodes(node.children, option)
        };
      }
      return node;
    });
  };

  // Filter files based on search query
  const filterNodes = (nodes: FileNode[], query: string): FileNode[] => {
    if (!query.trim()) return nodes;

    const lowerQuery = query.toLowerCase();
    
    return nodes.reduce((acc: FileNode[], node) => {
      if (node.type === 'folder') {
        // For folders, check if any children match
        const filteredChildren = node.children ? filterNodes(node.children, query) : [];
        
        // Include folder if it matches or has matching children
        if (node.name.toLowerCase().includes(lowerQuery) || filteredChildren.length > 0) {
          acc.push({
            ...node,
            children: filteredChildren.length > 0 ? filteredChildren : node.children
          });
        }
      } else {
        // For files, check if name matches
        if (node.name.toLowerCase().includes(lowerQuery)) {
          acc.push(node);
        }
      }
      return acc;
    }, []);
  };

  const sortedFiles = sortNodes(files, sortOption);
  const filteredFiles = filterNodes(sortedFiles, searchQuery);
  
  // Check if files have timestamp data
  const hasTimestampData = files.some(f => f.type === 'file' && (f.createdAt || f.modifiedAt));
  
  // Log sorting info for debugging
  useEffect(() => {
    console.log('[FileBrowser] Sorting:', {
      option: sortOption,
      fileCount: files.length,
      hasTimestamps: hasTimestampData,
      sample: files.slice(0, 3).map(f => ({
        name: f.name,
        type: f.type,
        createdAt: f.createdAt,
        modifiedAt: f.modifiedAt
      }))
    });
  }, [sortOption, files, hasTimestampData]);

  // Clear selection when clicking outside file items
  const handleContainerClick = () => {
    setSelectedFiles(new Set());
    setLastClickedFile(null);
  };

  const getSortIcon = () => {
    switch (sortOption) {
      case 'name-asc':
        return <ArrowUpAZ className="w-4 h-4" />;
      case 'name-desc':
        return <ArrowDownAZ className="w-4 h-4" />;
      case 'created-new':
      case 'created-old':
        return <Clock className="w-4 h-4" />;
      case 'modified-new':
      case 'modified-old':
        return <CalendarClock className="w-4 h-4" />;
      default:
        return <ArrowUpDown className="w-4 h-4" />;
    }
  };

  const getSortLabel = () => {
    switch (sortOption) {
      case 'name-asc':
        return 'File name (A to Z)';
      case 'name-desc':
        return 'File name (Z to A)';
      case 'created-new':
        return 'Created time (new to old)';
      case 'created-old':
        return 'Created time (old to new)';
      case 'modified-new':
        return 'Modified time (new to old)';
      case 'modified-old':
        return 'Modified time (old to new)';
      default:
        return 'Sort';
    }
  };

  return (
    <div
      className={`border-r border-border bg-gradient-to-b from-sidebar/80 to-sidebar flex flex-col h-full backdrop-blur-sm relative ${isExternalDragOver ? 'ring-2 ring-primary ring-inset' : ''}`}
      onDragOver={handleSidebarDragOver}
      onDragLeave={handleSidebarDragLeave}
      onDrop={handleSidebarDrop}
    >
      {/* External file drop overlay */}
      {isExternalDragOver && !isImporting && (
        <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center pointer-events-none z-20">
          <div className="text-center bg-background/90 rounded-lg p-4 shadow-lg">
            <Upload className="w-8 h-8 mx-auto mb-2 text-primary" />
            <p className="text-sm font-medium text-primary">Drop .md files to import</p>
            <p className="text-xs text-muted-foreground mt-1">Files will be added to root</p>
          </div>
        </div>
      )}

      {/* Importing overlay with spinner */}
      {isImporting && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-20">
          <div className="text-center bg-background rounded-lg p-6 shadow-lg border border-border">
            <div className="w-8 h-8 mx-auto mb-3 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-sm font-medium text-foreground">Importing notes...</p>
            <p className="text-xs text-muted-foreground mt-1">Adding to database</p>
          </div>
        </div>
      )}
      <div className="p-4 border-b border-sidebar-border bg-sidebar/50 backdrop-blur-sm space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-sidebar-accent border-sidebar-border"
          />
        </div>
        
        {onSortChange && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                {getSortIcon()}
                <span className="flex-1 text-left truncate">{getSortLabel()}</span>
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem onClick={() => onSortChange('name-asc')}>
                <ArrowUpAZ className="w-4 h-4 mr-2" />
                File name (A to Z)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSortChange('name-desc')}>
                <ArrowDownAZ className="w-4 h-4 mr-2" />
                File name (Z to A)
              </DropdownMenuItem>
              {!hasTimestampData && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground italic">
                  ⚠️ Timestamp sorting unavailable
                </div>
              )}
              <DropdownMenuItem 
                onClick={() => onSortChange('created-new')}
                disabled={!hasTimestampData}
                className={!hasTimestampData ? 'opacity-50' : ''}
              >
                <Clock className="w-4 h-4 mr-2" />
                Created time (new to old)
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onSortChange('created-old')}
                disabled={!hasTimestampData}
                className={!hasTimestampData ? 'opacity-50' : ''}
              >
                <Clock className="w-4 h-4 mr-2" />
                Created time (old to new)
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onSortChange('modified-new')}
                disabled={!hasTimestampData}
                className={!hasTimestampData ? 'opacity-50' : ''}
              >
                <CalendarClock className="w-4 h-4 mr-2" />
                Modified time (new to old)
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onSortChange('modified-old')}
                disabled={!hasTimestampData}
                className={!hasTimestampData ? 'opacity-50' : ''}
              >
                <CalendarClock className="w-4 h-4 mr-2" />
                Modified time (old to new)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      
      <ScrollArea className="flex-1" onClick={handleContainerClick}>
        <div className="p-1">
          {/* Special _Images folder */}
          {onImagesGalleryClick && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 mb-2 hover:bg-sidebar-accent/60 rounded-lg cursor-pointer group transition-all duration-200 hover:shadow-sm bg-primary/5 border border-primary/20"
              onClick={(e) => {
                e.stopPropagation();
                onImagesGalleryClick();
              }}
            >
              <ImageIcon className="w-4 h-4 text-primary" />
              <span className="flex-1 font-medium text-primary" style={{ fontSize: `${sidebarFontSize}px` }}>_Images</span>
              {imageCount > 0 && (
                <span className="text-primary/60" style={{ fontSize: `${sidebarFontSize - 2}px` }}>{imageCount}</span>
              )}
            </div>
          )}
          
          {filteredFiles.length > 0 ? (
            filteredFiles.map((node) => (
              <FileTreeItem
                key={node.id}
                node={node}
                activeFileId={activeFileId}
                selectedFiles={selectedFiles}
                onFileSelect={onFileSelect}
                onFileDelete={onFileDelete}
                onFileMoveToFolder={onFileMoveToFolder}
                onFileClick={handleFileClick}
                fontSize={sidebarFontSize}
                onExternalFilesImport={onExternalFilesImport}
                onInvalidFileDrop={onInvalidFileDrop}
              />
            ))
          ) : (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground" onClick={handleContainerClick}>
              {searchQuery ? (
                <>
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No files found matching "{searchQuery}"</p>
                </>
              ) : (
                <p>No files</p>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
      
      <div className="p-3 border-t border-sidebar-border bg-sidebar/30 backdrop-blur-sm" onClick={handleContainerClick}>
        {selectedFiles.size > 0 && (
          <div className="mb-2 px-3 py-2 bg-violet-500/10 border border-violet-500/50 rounded-lg text-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="text-violet-500 font-medium">
                {selectedFiles.size} note{selectedFiles.size > 1 ? 's' : ''} selected
              </span>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 text-xs"
                onClick={() => setSelectedFiles(new Set())}
              >
                Clear
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Drag to folder or Shift+Click to select more
            </p>
          </div>
        )}
        <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
          <div className="flex gap-2">
            <Button
              onClick={onFileCreate}
              className="flex-1 gap-2 shadow-sm hover:shadow-md transition-all duration-200"
              variant="default"
            >
              <Plus className="w-4 h-4" />
              New Note
            </Button>
            <Button
              onClick={onFolderCreate}
              className="gap-2 shadow-sm hover:shadow-md transition-all duration-200"
              variant="outline"
              size="sm"
            >
              <FolderPlus className="w-4 h-4" />
            </Button>
          </div>
          <Button
            onClick={onSettingsClick}
            className="w-full gap-2 shadow-sm hover:shadow-md transition-all duration-200"
            variant="secondary"
            size="sm"
          >
            <Settings className="w-4 h-4 text-primary" />
            Settings
          </Button>
          {onVaultImportClick && (
            <Button
              onClick={onVaultImportClick}
              className="w-full gap-2 shadow-sm hover:shadow-md transition-all duration-200"
              variant="outline"
              size="sm"
            >
              <Upload className="w-4 h-4 text-primary" />
              Import Files
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
