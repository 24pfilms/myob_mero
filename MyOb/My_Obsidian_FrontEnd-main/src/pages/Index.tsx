import { useState, useEffect } from "react";
import { EditorToolbar } from "@/components/Editor/EditorToolbar";
import { FileBrowser } from "@/components/Editor/FileBrowser";
import { EnhancedMarkdownEditor } from "@/components/Editor/EnhancedMarkdownEditor";
import { MarkdownPreview } from "@/components/Editor/MarkdownPreview";
import { CommandPalette } from "@/components/Editor/CommandPalette";
import { ImportHotspot } from "@/components/ImportModal/ImportHotspot";
import { VaultImportModal } from "@/components/ImportModal/VaultImportModal";
import { AIChatPanel } from "@/components/AI/AIChatPanel";
import { AIChatModal } from "@/components/AI/AIChatModal";
import { ImageGenerationModal } from "@/components/AI/ImageGenerationModal";
import { SettingsModal, loadSettings, AppSettings } from "@/components/Editor/SettingsModal";
import { ScrollLockHandle } from "@/components/Editor/ScrollLockHandle";
import { ImagesGallery } from "@/components/Editor/ImagesGallery";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { transformNotesToFileNodes, FileNode } from "@/lib/dataTransform";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";

const Index = () => {
  console.log('Index component rendering');
  const { toast } = useToast();
  const [settings, setSettings] = useState<AppSettings>(loadSettings());
  
  const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'split'>(() => {
    // Restore last view mode from localStorage, fallback to settings default
    const savedViewMode = localStorage.getItem('myob-view-mode') as 'edit' | 'preview' | 'split' | null;
    return savedViewMode || settings.defaultViewMode;
  });
  
  // Apply saved accent color and text luminance on mount
  useEffect(() => {
    const savedSettings = loadSettings();
    if (savedSettings.accentColorHue !== undefined) {
      const hslColor = `${savedSettings.accentColorHue} ${savedSettings.accentColorSaturation}% ${savedSettings.accentColorLightness}%`;
      document.documentElement.style.setProperty('--primary', hslColor);
      document.documentElement.style.setProperty('--primary-glow', hslColor);
      document.documentElement.style.setProperty('--accent', hslColor);
      document.documentElement.style.setProperty('--ring', hslColor);
      document.documentElement.style.setProperty('--sidebar-primary', hslColor);
      document.documentElement.style.setProperty('--sidebar-ring', hslColor);
    }
    if (savedSettings.textLuminance !== undefined) {
      const textColor = `240 5% ${savedSettings.textLuminance}%`;
      document.documentElement.style.setProperty('--foreground', textColor);
      document.documentElement.style.setProperty('--card-foreground', textColor);
      document.documentElement.style.setProperty('--popover-foreground', textColor);
      document.documentElement.style.setProperty('--sidebar-foreground', textColor);
    }
  }, []);

  // Persist viewMode to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('myob-view-mode', viewMode);
  }, [viewMode]);

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [backendConnected, setBackendConnected] = useState(false);
  const [activeFileId, setActiveFileId] = useState(() => {
    // Restore last active file from localStorage
    return localStorage.getItem('myob-active-file') || '';
  });

  // Persist activeFileId to localStorage when it changes
  useEffect(() => {
    if (activeFileId) {
      localStorage.setItem('myob-active-file', activeFileId);
    }
  }, [activeFileId]);

  const [currentContent, setCurrentContent] = useState('');
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [aiChatOpen, setAIChatOpen] = useState(false);
  const [aiChatModalMode, setAIChatModalMode] = useState<'panel' | 'modal'>('modal'); // New: Toggle between side panel and floating modal
  const [imageGenModalOpen, setImageGenModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [scrollLocked, setScrollLocked] = useState(true); // Default to locked for better UX
  const [isSaving, setIsSaving] = useState(false);
  const [imagesGalleryOpen, setImagesGalleryOpen] = useState(false);
  const [isImportingFiles, setIsImportingFiles] = useState(false);
  const [vaultImportModalOpen, setVaultImportModalOpen] = useState(false);

  // Load notes and folders from backend
  useEffect(() => {
    const loadBackendData = async () => {
      try {
        // Test backend connection first
        await api.testConnection();
        setBackendConnected(true);
        
        // Load all notes and folders
        const [notes, folders] = await Promise.all([
          api.getNotes(),
          api.getFolders()
        ]);
        
        const fileNodes = transformNotesToFileNodes(notes, folders);
        
        // Preserve any existing local files (new notes) only after initial load
        if (hasLoadedOnce) {
          const existingLocalFiles = files.filter(f => f.id.startsWith('file-'));
          const allFiles = [...fileNodes, ...existingLocalFiles];
          // Don't sort here - let FileBrowser handle sorting based on user preference
          setFiles(allFiles);
        } else {
          // Don't sort here - let FileBrowser handle sorting based on user preference
          setFiles(fileNodes);
          setHasLoadedOnce(true);
        }
        
        // Restore or set active file
        if (notes.length > 0) {
          // Check if saved activeFileId exists in loaded notes
          const savedFileExists = activeFileId && notes.some(n => n.id === activeFileId);
          if (!savedFileExists) {
            // Saved file doesn't exist or none saved - use first note
            setActiveFileId(notes[0].id);
          }
          // If savedFileExists, activeFileId is already set from localStorage
        }
        
        toast({
          title: "Connected to MyOb Vault",
          description: `Loaded ${notes.length} notes and ${folders.length} folders from your vault.`,
        });
      } catch (error) {
        console.error('Failed to connect to backend:', error);
        setBackendConnected(false);
        toast({
          title: "Backend Connection Failed",
          description: "Using offline mode. Start the backend server to access your Obsidian vault.",
          variant: "destructive",
        });
        
        // Fallback to demo content
        setFiles([{
          id: 'demo',
          name: 'Demo Note',
          type: 'file',
          content: '# Backend Not Connected\n\nStart the backend server to load your Obsidian notes.\n\n## To connect:\n1. Navigate to the backend directory\n2. Run: `python runner.py`\n3. Refresh this page'
        }]);
        setActiveFileId('demo');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadBackendData();
  }, []);

  // Load active file content
  useEffect(() => {
    const loadNoteContent = async () => {
      if (!activeFileId) return;
      
      // First check if this is a local file (new files start with 'file-')
      const localFile = files.find(f => f.id === activeFileId);
      if (localFile && localFile.id.startsWith('file-')) {
        // This is a newly created local file
        setCurrentContent(localFile.content || '');
        setHasUnsavedChanges(false);
        return;
      }
      
      if (!backendConnected) {
        // Handle offline mode
        const demoFile = files.find(f => f.id === activeFileId);
        if (demoFile && demoFile.content) {
          setCurrentContent(demoFile.content);
        }
        return;
      }
      
      try {
        const note = await api.getNote(activeFileId);
        setCurrentContent(note.content);
        setHasUnsavedChanges(false);
      } catch (error) {
        console.error('Failed to load note:', error);
        // If backend fails, try to load from local files
        const fallbackFile = files.find(f => f.id === activeFileId);
        if (fallbackFile && fallbackFile.content) {
          setCurrentContent(fallbackFile.content);
          setHasUnsavedChanges(false);
        } else {
          toast({
            title: "Failed to load note",
            description: "Could not load the selected note.",
            variant: "destructive",
          });
        }
      }
    };
    
    if (activeFileId) {
      loadNoteContent();
    }
  }, [activeFileId, backendConnected, files]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command Palette (Ctrl+P)
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }

      // Save (Ctrl+S)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }

      // New Note (Ctrl+N)
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        handleFileCreate();
      }

      // Import (Ctrl+Shift+I)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        setImportModalOpen(true);
      }

      // Toggle Edit/Preview (Ctrl+E)
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        // Cycle through: edit -> preview -> split -> edit
        setViewMode(prev => prev === 'edit' ? 'preview' : prev === 'preview' ? 'split' : 'edit');
      }

      // Toggle AI Chat Mode (Shift+Alt+A)
      if (e.shiftKey && e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setAIChatModalMode(prev => {
          const newMode = prev === 'panel' ? 'modal' : 'panel';
          toast({
            title: "AI Chat Mode",
            description: `Switched to ${newMode === 'panel' ? 'Side Panel' : 'Floating Modal'} mode`,
          });
          return newMode;
        });
      }

      // Delete Note (Delete or Backspace key)
      if ((e.key === 'Delete' || e.key === 'Backspace') && activeFileId) {
        // Only trigger if we're not in an input field
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
          e.preventDefault();
          handleFileDelete(activeFileId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentContent, viewMode, activeFileId]);

  const handleSave = async () => {
    if (!activeFileId || isSaving) return;
    
    setIsSaving(true);
    const startTime = Date.now();
    console.log('[Save:Frontend] Starting save...');
    
    try {
      // Check if this is a new local file that needs to be created in backend
      if (activeFileId.startsWith('file-')) {
        // Extract title from content for new files
        const lines = currentContent.split('\n');
        const firstLine = lines[0]?.replace(/^#+\s*/, '') || 'Untitled Note';
        
        // Extract tags from content (look for #tag patterns)
        const tagMatches = currentContent.match(/#(\w+)/g) || [];
        const tags = tagMatches.map(tag => tag.slice(1)); // Remove # prefix
        
        if (backendConnected) {
          // Create new note in backend database
          const newNote = await api.createNote({
            title: firstLine.slice(0, 200),
            content: currentContent, // This includes base64 images!
            tags: tags,
            folder_id: null
          });
          
          // Update local state with backend ID
          const updateFileContent = (nodes: FileNode[]): FileNode[] => {
            return nodes.map((node) => {
              if (node.id === activeFileId && node.type === 'file') {
                return { 
                  ...node,
                  id: newNote.id, // Replace local ID with backend ID
                  name: firstLine.slice(0, 50),
                  content: currentContent 
                };
              }
              if (node.children) {
                return { ...node, children: updateFileContent(node.children) };
              }
              return node;
            });
          };
          
          const updatedFiles = updateFileContent(files);
          setFiles(updatedFiles);
          setActiveFileId(newNote.id); // Update active file to use backend ID
          
          console.log('[Save] Created new note in database:', newNote.id);
        } else {
          // Offline mode - just update local state
          const updateFileContent = (nodes: FileNode[]): FileNode[] => {
            return nodes.map((node) => {
              if (node.id === activeFileId && node.type === 'file') {
                return { 
                  ...node, 
                  name: firstLine.slice(0, 50),
                  content: currentContent 
                };
              }
              if (node.children) {
                return { ...node, children: updateFileContent(node.children) };
              }
              return node;
            });
          };
          
          const updatedFiles = updateFileContent(files);
          setFiles(updatedFiles);
        }
      } else {
        // Handle existing backend files - UPDATE them in the database
        if (backendConnected) {
          // Extract title from content
          const lines = currentContent.split('\n');
          const firstLine = lines[0]?.replace(/^#+\s*/, '') || 'Untitled Note';
          
          // Extract tags
          const tagMatches = currentContent.match(/#(\w+)/g) || [];
          const tags = tagMatches.map(tag => tag.slice(1));
          
          // CRITICAL: Save to database with full content including base64 images
          const apiStartTime = Date.now();
          console.log('[Save:Frontend] Calling API, content length:', currentContent.length);
          
          await api.updateNote(activeFileId, {
            title: firstLine.slice(0, 200),
            content: currentContent, // Base64 images are preserved here!
            tags: tags
          });
          
          const apiEndTime = Date.now();
          console.log('[Save:Frontend] API call completed in', (apiEndTime - apiStartTime), 'ms');
          console.log('[Save] Updated note in database:', activeFileId, 'Content length:', currentContent.length);
        }
        
        // Update local state
        const updateFileContent = (nodes: FileNode[]): FileNode[] => {
          return nodes.map((node) => {
            if (node.id === activeFileId && node.type === 'file') {
              return { ...node, content: currentContent };
            }
            if (node.children) {
              return { ...node, children: updateFileContent(node.children) };
            }
            return node;
          });
        };
        
        const updatedFiles = updateFileContent(files);
        setFiles(updatedFiles);
      }

      setHasUnsavedChanges(false);
      
      const duration = Date.now() - startTime;
      console.log(`[Save] Complete in ${duration}ms`);
      
      toast({
        title: "Saved",
        description: `Your note has been saved successfully (${duration}ms)`,
      });
    } catch (error: any) {
      console.error('[Save] Failed to save note:', error);
      toast({
        title: "Save failed",
        description: error.message || "Could not save note. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleContentChange = (newContent: string) => {
    setCurrentContent(newContent);
    setHasUnsavedChanges(true);
  };

  const handleFileCreate = () => {
    const newFile: FileNode = {
      id: `file-${Date.now()}`,
      name: 'Untitled Note',
      type: 'file',
      content: '# Untitled Note\n\nStart writing here...',
    };

    const updatedFiles = [...files, newFile];
    setFiles(updatedFiles);
    setActiveFileId(newFile.id);
    setCurrentContent(newFile.content);
    setHasUnsavedChanges(false);
    
    toast({
      title: "Note created",
      description: "A new note has been created.",
    });
  };

  const handleFolderCreate = () => {
    setFolderDialogOpen(true);
    setNewFolderName('');
  };

  const handleFolderSubmit = async () => {
    if (!newFolderName.trim()) return;

    try {
      // Create folder via API
      const folderPath = newFolderName.trim();
      const createdFolder = await api.createFolder(folderPath);
      
      // Refresh data from backend
      const [notes, folders] = await Promise.all([
        api.getNotes(),
        api.getFolders()
      ]);
      
      const fileNodes = transformNotesToFileNodes(notes, folders);
      
      // Preserve any existing local files (new notes)
      const existingLocalFiles = files.filter(f => f.id.startsWith('file-'));
      const allFiles = [...fileNodes, ...existingLocalFiles];
      
      setFiles(allFiles);
      setFolderDialogOpen(false);
      setNewFolderName('');
      
      toast({
        title: "Folder created",
        description: `Folder "${newFolderName}" has been created and saved to your vault.`,
      });
    } catch (error) {
      console.error('Failed to create folder:', error);
      toast({
        title: "Failed to create folder",
        description: "Could not create folder. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleFileMoveToFolder = async (fileId: string, folderId: string) => {
    // Only move backend files, not local files
    if (fileId.startsWith('file-')) {
      // Handle local file move
      const moveFile = (nodes: FileNode[]): FileNode[] => {
        let movedFile: FileNode | null = null;
        
        // First pass: find and remove the file
        const withoutFile = nodes.filter(node => {
          if (node.id === fileId) {
            movedFile = node;
            return false;
          }
          if (node.children) {
            node.children = moveFile(node.children);
          }
          return true;
        });
        
        // Second pass: add the file to the target folder
        if (movedFile) {
          const addToFolder = (nodes: FileNode[]): FileNode[] => {
            return nodes.map(node => {
              if (node.id === folderId && node.type === 'folder') {
                const updatedChildren = [...(node.children || []), movedFile!];
                return { ...node, children: updatedChildren };
              }
              if (node.children) {
                return { ...node, children: addToFolder(node.children) };
              }
              return node;
            });
          };
          return addToFolder(withoutFile);
        }
        
        return withoutFile;
      };

      const updatedFiles = moveFile(files);
      setFiles(updatedFiles);
      
      // Find file and folder names for the toast
      const findNode = (nodes: FileNode[], id: string): FileNode | null => {
        for (const node of nodes) {
          if (node.id === id) return node;
          if (node.children) {
            const found = findNode(node.children, id);
            if (found) return found;
          }
        }
        return null;
      };
      
      const file = findNode(files, fileId);
      const folder = findNode(updatedFiles, folderId);
      
      toast({
        title: "File moved",
        description: `"${file?.name}" moved to "${folder?.name}" folder.`,
      });
      return;
    }

    // Handle backend file move
    try {
      await api.moveNoteToFolder(fileId, folderId);
      
      // Refresh data from backend
      const [notes, folders] = await Promise.all([
        api.getNotes(),
        api.getFolders()
      ]);
      
      const fileNodes = transformNotesToFileNodes(notes, folders);
      
      // Preserve any existing local files (new notes)
      const existingLocalFiles = files.filter(f => f.id.startsWith('file-'));
      const allFiles = [...fileNodes, ...existingLocalFiles];
      
      setFiles(allFiles);
      
      // Find file and folder names for the toast
      const file = notes.find(n => n.id === fileId);
      const folder = folders.find(f => f.id === folderId);
      
      toast({
        title: "File moved",
        description: `"${file?.title}" moved to "${folder?.name}" folder.`,
      });
    } catch (error) {
      console.error('Failed to move file:', error);
      toast({
        title: "Failed to move file",
        description: "Could not move file to folder. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleFileDelete = (fileId: string) => {
    const deleteFile = (nodes: FileNode[]): FileNode[] => {
      return nodes.filter((node) => {
        if (node.id === fileId) return false;
        if (node.children) {
          node.children = deleteFile(node.children);
        }
        return true;
      });
    };

    setFiles(deleteFile(files));
    if (activeFileId === fileId) {
      setActiveFileId(files[0]?.id || '');
    }
    toast({
      title: "Note deleted",
      description: "The note has been deleted.",
      variant: "destructive",
    });
  };

  // Handle external .md file drop import
  const handleExternalFilesImport = async (
    droppedFiles: File[],
    targetFolderId?: string | null
  ) => {
    // Filter to only .md files
    const mdFiles = droppedFiles.filter(f => f.name.toLowerCase().endsWith('.md'));

    if (mdFiles.length === 0) {
      toast({
        title: "Invalid files",
        description: "Only .md (Markdown) files can be imported.",
        variant: "destructive",
      });
      return;
    }

    // Show loading state
    setIsImportingFiles(true);

    try {
      // Read all file contents
      const fileContents = await Promise.all(
        mdFiles.map(async (file) => ({
          filename: file.name,
          content: await file.text(),
          folder_id: targetFolderId,
        }))
      );

      // Call bulk import API
      const result = await api.bulkImportNotes(fileContents);

      // Refresh file list from backend
      const [notes, folders] = await Promise.all([
        api.getNotes(),
        api.getFolders()
      ]);
      const fileNodes = transformNotesToFileNodes(notes, folders);

      // Preserve any existing local files (new notes)
      const existingLocalFiles = files.filter(f => f.id.startsWith('file-'));
      const allFiles = [...fileNodes, ...existingLocalFiles];
      setFiles(allFiles);

      // Show result toast
      if (result.success > 0) {
        toast({
          title: "Import complete!",
          description: `Successfully imported ${result.success} note${result.success > 1 ? 's' : ''}${result.failed > 0 ? ` (${result.failed} failed)` : ''}`,
        });

        // Select first imported note
        if (result.imported.length > 0) {
          setActiveFileId(result.imported[0].id);
        }
      } else {
        toast({
          title: "Import failed",
          description: result.errors[0]?.error || "Could not import files",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Failed to import files:', error);
      toast({
        title: "Import failed",
        description: error.message || "Could not import files. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsImportingFiles(false);
    }
  };

  // Handle invalid (non-.md) file drops
  const handleInvalidFileDrop = (fileNames: string[]) => {
    toast({
      title: "Invalid files",
      description: `Only .md files can be imported. Dropped: ${fileNames.join(', ')}`,
      variant: "destructive",
    });
  };

  const handleCommand = (command: string) => {
    switch (command) {
      case 'new-note':
        handleFileCreate();
        break;
      case 'save':
        handleSave();
        break;
      case 'delete':
        if (activeFileId) {
          handleFileDelete(activeFileId);
        }
        break;
      case 'export':
        // Export as markdown
        const blob = new Blob([currentContent], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'note.md';
        a.click();
        toast({
          title: "Exported",
          description: "Note exported as Markdown.",
        });
        break;
      default:
        toast({
          title: "Coming soon",
          description: "This feature is under development.",
        });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen w-full bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Connecting to your Obsidian vault...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-gradient-to-br from-background via-background to-muted/20 relative">
      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.03),transparent_70%)] pointer-events-none" />
      
      {!backendConnected && (
        <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-2 backdrop-blur-sm relative z-10">
          <p className="text-sm text-destructive-foreground">
            ⚠️ Backend disconnected - Running in demo mode. Start the backend server to access your vault.
          </p>
        </div>
      )}
      <div className="relative z-10">
        <EditorToolbar
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onSave={handleSave}
          onCommandPalette={() => setCommandPaletteOpen(true)}
          onAIAssist={() => setAIChatOpen(true)}
          onGenerateImage={() => setImageGenModalOpen(true)}
          hasUnsavedChanges={hasUnsavedChanges}
          isSaving={isSaving}
          sidebarOpen={sidebarOpen}
          onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
          appName={settings.appName}
        />
      </div>

      <div className="flex flex-1 overflow-hidden relative z-10">
        {sidebarOpen ? (
          <ResizablePanelGroup direction="horizontal" className="flex-1">
            <ResizablePanel defaultSize={20} minSize={15} maxSize={40}>
              <FileBrowser
                files={files}
                activeFileId={activeFileId}
                onFileSelect={setActiveFileId}
                onFileCreate={handleFileCreate}
                onFolderCreate={handleFolderCreate}
                onFileDelete={handleFileDelete}
                onFileMoveToFolder={handleFileMoveToFolder}
                onSettingsClick={() => setSettingsModalOpen(true)}
                onImagesGalleryClick={() => setImagesGalleryOpen(true)}
                imageCount={(() => {
                  // Count images across all notes
                  let count = 0;
                  files.forEach(f => {
                    if (f.type === 'file' && f.content) {
                      const matches = f.content.match(/!\[[^\]]*\]\(data:image\/[^)]+\)/g);
                      if (matches) count += matches.length;
                    }
                  });
                  return count;
                })()}
                sortOption={settings.fileSortOption}
                onSortChange={(sortOption) => {
                  const newSettings = { ...settings, fileSortOption: sortOption };
                  setSettings(newSettings);
                  localStorage.setItem('myob-settings', JSON.stringify(newSettings));
                }}
                sidebarFontSize={settings.sidebarFontSize}
                onExternalFilesImport={handleExternalFilesImport}
                onInvalidFileDrop={handleInvalidFileDrop}
                isImporting={isImportingFiles}
                onVaultImportClick={() => setVaultImportModalOpen(true)}
              />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={80} minSize={60}>
              <div className="flex-1 overflow-hidden h-full">
                {viewMode === 'split' ? (
                  <ResizablePanelGroup direction="horizontal" className="h-full">
                    <ResizablePanel defaultSize={50} minSize={30}>
                      {settings.splitLayoutReversed ? (
                        <MarkdownPreview
                          content={currentContent}
                          scrollLocked={scrollLocked}
                          scrollTarget="editor"
                          fontFamily={settings.previewFontFamily}
                          fontSize={settings.previewFontSize}
                          backgroundBrightness={settings.previewBackgroundBrightness}
                          backgroundTexture={settings.previewBackgroundTexture}
                          textureIntensity={settings.textureIntensity}
                          textureScale={settings.textureScale}
                          textureColor={settings.textureColor}
                          gridLineThickness={settings.gridLineThickness}
                          gridStyle={settings.gridStyle}
                          textColor={settings.previewTextColor}
                          textLuminance={settings.textLuminance}
                          backgroundColorHue={settings.backgroundColorHue}
                          backgroundColorSaturation={settings.backgroundColorSaturation}
                          backgroundColorLightness={settings.backgroundColorLightness}
                        />
                      ) : (
                        <EnhancedMarkdownEditor
                          value={currentContent}
                          onChange={handleContentChange}
                          scrollLocked={scrollLocked}
                          scrollTarget="preview"
                          fontFamily={settings.editorFontFamily}
                          fontSize={settings.editorFontSize}
                        />
                      )}
                    </ResizablePanel>
                    <ScrollLockHandle
                      scrollLocked={scrollLocked}
                      onScrollLockToggle={() => setScrollLocked(!scrollLocked)}
                    />
                    <ResizablePanel defaultSize={50} minSize={30}>
                      {settings.splitLayoutReversed ? (
                        <EnhancedMarkdownEditor
                          value={currentContent}
                          onChange={handleContentChange}
                          scrollLocked={scrollLocked}
                          scrollTarget="preview"
                          fontFamily={settings.editorFontFamily}
                          fontSize={settings.editorFontSize}
                        />
                      ) : (
                        <MarkdownPreview
                          content={currentContent}
                          scrollLocked={scrollLocked}
                          scrollTarget="editor"
                          fontFamily={settings.previewFontFamily}
                          fontSize={settings.previewFontSize}
                          backgroundBrightness={settings.previewBackgroundBrightness}
                          backgroundTexture={settings.previewBackgroundTexture}
                          textureIntensity={settings.textureIntensity}
                          textureScale={settings.textureScale}
                          textureColor={settings.textureColor}
                          gridLineThickness={settings.gridLineThickness}
                          gridStyle={settings.gridStyle}
                          textColor={settings.previewTextColor}
                          textLuminance={settings.textLuminance}
                          backgroundColorHue={settings.backgroundColorHue}
                          backgroundColorSaturation={settings.backgroundColorSaturation}
                          backgroundColorLightness={settings.backgroundColorLightness}
                        />
                      )}
                    </ResizablePanel>
                  </ResizablePanelGroup>
                ) : viewMode === 'edit' ? (
                  <EnhancedMarkdownEditor
                    value={currentContent}
                    onChange={handleContentChange}
                    fontFamily={settings.editorFontFamily}
                    fontSize={settings.editorFontSize}
                  />
                ) : (
                  <MarkdownPreview 
                    content={currentContent}
                    fontFamily={settings.previewFontFamily}
                    fontSize={settings.previewFontSize}
                    backgroundBrightness={settings.previewBackgroundBrightness}
                    backgroundTexture={settings.previewBackgroundTexture}
                    textureIntensity={settings.textureIntensity}
                    textureScale={settings.textureScale}
                    textureColor={settings.textureColor}
                    gridLineThickness={settings.gridLineThickness}
                    gridStyle={settings.gridStyle}
                    textColor={settings.previewTextColor}
                    textLuminance={settings.textLuminance}
                    backgroundColorHue={settings.backgroundColorHue}
                    backgroundColorSaturation={settings.backgroundColorSaturation}
                    backgroundColorLightness={settings.backgroundColorLightness}
                  />
                )}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <div className="flex-1 overflow-hidden h-full">
            {viewMode === 'split' ? (
              <ResizablePanelGroup direction="horizontal" className="h-full">
                <ResizablePanel defaultSize={50} minSize={30}>
                  {settings.splitLayoutReversed ? (
                    <MarkdownPreview
                      content={currentContent}
                      scrollLocked={scrollLocked}
                      scrollTarget="editor"
                      fontFamily={settings.previewFontFamily}
                      fontSize={settings.previewFontSize}
                      backgroundBrightness={settings.previewBackgroundBrightness}
                      backgroundTexture={settings.previewBackgroundTexture}
                      textureIntensity={settings.textureIntensity}
                      textureScale={settings.textureScale}
                      textureColor={settings.textureColor}
                      gridLineThickness={settings.gridLineThickness}
                      gridStyle={settings.gridStyle}
                      textColor={settings.previewTextColor}
                      textLuminance={settings.textLuminance}
                      backgroundColorHue={settings.backgroundColorHue}
                      backgroundColorSaturation={settings.backgroundColorSaturation}
                      backgroundColorLightness={settings.backgroundColorLightness}
                    />
                  ) : (
                    <EnhancedMarkdownEditor
                      value={currentContent}
                      onChange={handleContentChange}
                      scrollLocked={scrollLocked}
                      scrollTarget="preview"
                      fontFamily={settings.editorFontFamily}
                      fontSize={settings.editorFontSize}
                    />
                  )}
                </ResizablePanel>
                <ScrollLockHandle
                  scrollLocked={scrollLocked}
                  onScrollLockToggle={() => setScrollLocked(!scrollLocked)}
                />
                <ResizablePanel defaultSize={50} minSize={30}>
                  {settings.splitLayoutReversed ? (
                    <EnhancedMarkdownEditor
                      value={currentContent}
                      onChange={handleContentChange}
                      scrollLocked={scrollLocked}
                      scrollTarget="preview"
                      fontFamily={settings.editorFontFamily}
                      fontSize={settings.editorFontSize}
                    />
                  ) : (
                    <MarkdownPreview
                      content={currentContent}
                      scrollLocked={scrollLocked}
                      scrollTarget="editor"
                      fontFamily={settings.previewFontFamily}
                      fontSize={settings.previewFontSize}
                      backgroundBrightness={settings.previewBackgroundBrightness}
                      backgroundTexture={settings.previewBackgroundTexture}
                      textureIntensity={settings.textureIntensity}
                      textureScale={settings.textureScale}
                      textureColor={settings.textureColor}
                      gridLineThickness={settings.gridLineThickness}
                      gridStyle={settings.gridStyle}
                      textColor={settings.previewTextColor}
                      textLuminance={settings.textLuminance}
                      backgroundColorHue={settings.backgroundColorHue}
                      backgroundColorSaturation={settings.backgroundColorSaturation}
                      backgroundColorLightness={settings.backgroundColorLightness}
                    />
                  )}
                </ResizablePanel>
              </ResizablePanelGroup>
            ) : viewMode === 'edit' ? (
              <EnhancedMarkdownEditor
                value={currentContent}
                onChange={handleContentChange}
                fontFamily={settings.editorFontFamily}
                fontSize={settings.editorFontSize}
              />
            ) : (
              <MarkdownPreview 
                content={currentContent}
                fontFamily={settings.previewFontFamily}
                fontSize={settings.previewFontSize}
                backgroundBrightness={settings.previewBackgroundBrightness}
                backgroundTexture={settings.previewBackgroundTexture}
                textureIntensity={settings.textureIntensity}
                textureScale={settings.textureScale}
                textureColor={settings.textureColor}
                gridLineThickness={settings.gridLineThickness}
                gridStyle={settings.gridStyle}
                textColor={settings.previewTextColor}
                textLuminance={settings.textLuminance}
                backgroundColorHue={settings.backgroundColorHue}
                backgroundColorSaturation={settings.backgroundColorSaturation}
                backgroundColorLightness={settings.backgroundColorLightness}
              />
            )}
          </div>
        )}
      </div>

      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onCommand={handleCommand}
      />

      <ImportHotspot
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImportComplete={(noteId?: string) => {
          // Reload notes after import
          api.getNotes().then(notes => {
            api.getFolders().then(folders => {
              const fileNodes = transformNotesToFileNodes(notes, folders);
              setFiles(fileNodes);
              
              // If noteId provided, open that note
              if (noteId) {
                setActiveFileId(noteId);
                toast({
                  title: "Import successful!",
                  description: "Opening your imported note...",
                });
              } else {
                toast({
                  title: "Notes refreshed",
                  description: "Your imported content is now available",
                });
              }
            });
          });
        }}
      />
      
      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Enter folder name..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleFolderSubmit();
                }
                if (e.key === 'Escape') {
                  setFolderDialogOpen(false);
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFolderDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleFolderSubmit}
              disabled={!newFolderName.trim()}
            >
              Create Folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* AI Chat - Conditional rendering based on mode */}
      {aiChatModalMode === 'panel' ? (
        <AIChatPanel
          isOpen={aiChatOpen}
          onClose={() => setAIChatOpen(false)}
          currentNoteId={activeFileId}
          currentNoteContent={currentContent}
          onNavigateToNote={(noteId) => {
            setActiveFileId(noteId);
            setAIChatOpen(false);
          }}
        />
      ) : (
        <AIChatModal
          isOpen={aiChatOpen}
          onClose={() => setAIChatOpen(false)}
          currentNoteId={activeFileId}
          currentNoteContent={currentContent}
          onNavigateToNote={(noteId) => {
            setActiveFileId(noteId);
            setAIChatOpen(false);
          }}
        />
      )}
      
      {/* Image Generation Modal */}
      <ImageGenerationModal
        isOpen={imageGenModalOpen}
        onClose={() => setImageGenModalOpen(false)}
        noteId={activeFileId}
        onImageGenerated={(imageData, mimeType, prompt, aspectRatio) => {
          // Insert image markdown into the current note
          const imageMarkdown = `\n\n![Generated: ${prompt}](data:${mimeType};base64,${imageData})\n\n`;
          setCurrentContent(prev => prev + imageMarkdown);
          setHasUnsavedChanges(true);
          setImageGenModalOpen(false);
          
          toast({
            title: "Image inserted!",
            description: "Generated image has been added to your note",
          });
        }}
      />
      
      {/* Settings Modal */}
      <SettingsModal
        open={settingsModalOpen}
        onOpenChange={setSettingsModalOpen}
        settings={settings}
        onSettingsChange={(newSettings) => {
          setSettings(newSettings);
          // Apply default view mode if changed
          if (newSettings.defaultViewMode !== settings.defaultViewMode) {
            setViewMode(newSettings.defaultViewMode);
          }
        }}
      />

      {/* Vault Import Modal */}
      <VaultImportModal
        isOpen={vaultImportModalOpen}
        onClose={() => setVaultImportModalOpen(false)}
        onImportComplete={async () => {
          // Refresh file list after vault import
          try {
            const [notes, folders] = await Promise.all([
              api.getNotes(),
              api.getFolders()
            ]);
            const fileNodes = transformNotesToFileNodes(notes, folders);
            setFiles(fileNodes);
          } catch (error) {
            console.error('Failed to refresh files after import:', error);
          }
        }}
      />

      {/* Images Gallery */}
      {imagesGalleryOpen && (
        <ImagesGallery
          content={currentContent}
          allNotes={files.filter(f => f.type === 'file').map(f => ({
            id: f.id,
            title: f.name,
            content: f.content || ''
          }))}
          onClose={() => setImagesGalleryOpen(false)}
        />
      )}
    </div>
  );
};

export default Index;
