import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Folder,
  FolderOpen,
  HardDrive,
  ChevronUp,
  FileText,
  Loader2,
  Home,
} from "lucide-react";
import { api } from "@/lib/api";

interface FolderBrowserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  initialPath?: string;
}

interface DirectoryItem {
  name: string;
  path: string;
  is_drive?: boolean;
  has_md_files?: boolean;
}

export function FolderBrowserDialog({
  isOpen,
  onClose,
  onSelect,
  initialPath,
}: FolderBrowserDialogProps) {
  const [currentPath, setCurrentPath] = useState<string>("");
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [directories, setDirectories] = useState<DirectoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mdFileCount, setMdFileCount] = useState(0);
  const [totalMdCount, setTotalMdCount] = useState(0);

  // Load directory contents
  const loadDirectory = async (path?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await api.browseFilesystem(path);
      setCurrentPath(result.current_path);
      setParentPath(result.parent_path);
      setDirectories(result.directories);
      setMdFileCount(result.md_file_count || 0);
      setTotalMdCount(result.total_md_count || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load directory");
    } finally {
      setIsLoading(false);
    }
  };

  // Load initial directory when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadDirectory(initialPath || undefined);
    }
  }, [isOpen, initialPath]);

  const handleNavigate = (path: string) => {
    loadDirectory(path);
  };

  const handleGoUp = () => {
    if (parentPath) {
      loadDirectory(parentPath);
    } else {
      // Go to root/drives
      loadDirectory(undefined);
    }
  };

  const handleGoHome = () => {
    // Go to root/drives
    loadDirectory(undefined);
  };

  const handleSelect = () => {
    if (currentPath) {
      onSelect(currentPath);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Browse for Folder</DialogTitle>
        </DialogHeader>

        {/* Current path display */}
        <div className="flex items-center gap-2 p-2 bg-muted rounded-lg text-sm">
          <FolderOpen className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="truncate flex-1 font-mono text-xs">
            {currentPath || "Select a drive"}
          </span>
        </div>

        {/* Navigation buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGoHome}
            disabled={isLoading || !currentPath}
            title="Go to drives/root"
          >
            <Home className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleGoUp}
            disabled={isLoading || (!parentPath && !currentPath)}
            title="Go up one level"
          >
            <ChevronUp className="w-4 h-4 mr-1" />
            Up
          </Button>
          {currentPath && totalMdCount > 0 && (
            <div className="flex items-center gap-1 ml-auto text-xs text-muted-foreground">
              <FileText className="w-3 h-3" />
              <span>{totalMdCount} .md files</span>
            </div>
          )}
        </div>

        {/* Directory list */}
        <ScrollArea className="flex-1 min-h-[300px] border rounded-lg">
          {isLoading ? (
            <div className="flex items-center justify-center h-full py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="p-4 text-center text-destructive">
              <p>{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={handleGoHome}
              >
                Go to drives
              </Button>
            </div>
          ) : directories.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <Folder className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No subfolders</p>
            </div>
          ) : (
            <div className="p-1">
              {directories.map((dir) => (
                <button
                  key={dir.path}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-accent rounded-md transition-colors text-left group"
                  onClick={() => handleNavigate(dir.path)}
                  onDoubleClick={() => {
                    onSelect(dir.path);
                    onClose();
                  }}
                >
                  {dir.is_drive ? (
                    <HardDrive className="w-5 h-5 text-blue-500 flex-shrink-0" />
                  ) : (
                    <Folder
                      className={`w-5 h-5 flex-shrink-0 ${
                        dir.has_md_files ? "text-primary" : "text-amber-500"
                      }`}
                    />
                  )}
                  <span className="flex-1 truncate">{dir.name}</span>
                  {dir.has_md_files && (
                    <FileText className="w-4 h-4 text-primary opacity-60" />
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Action buttons */}
        <div className="flex justify-between items-center pt-2">
          <p className="text-xs text-muted-foreground">
            Double-click to select, or navigate and click Select
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSelect} disabled={!currentPath}>
              Select Folder
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
