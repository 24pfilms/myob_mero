import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FolderOpen, FileText, FolderPlus, AlertCircle, CheckCircle2, Loader2, FolderSearch, Upload, Image, File } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { FolderBrowserDialog } from "./FolderBrowserDialog";

interface VaultImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

type ViewState = "input" | "preview" | "importing" | "complete";
type ImportMode = "folder" | "files";

interface PreviewData {
  file_count: number;
  folder_count: number;
  folders: string[];
  files: Array<{ name: string; path: string }>;
  has_more: boolean;
}

interface ImportResult {
  success: number;
  failed: number;
  folders_created: number;
  imported: Array<{ id: string; title: string; filename: string }>;
  errors: Array<{ filename: string; error: string }>;
}

interface SelectedFile {
  file: File;
  type: "markdown" | "text" | "image" | "other";
  preview?: string;
}

export function VaultImportModal({
  isOpen,
  onClose,
  onImportComplete,
}: VaultImportModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [view, setView] = useState<ViewState>("input");
  const [importMode, setImportMode] = useState<ImportMode>("files");
  const [folderPath, setFolderPath] = useState("");
  const [includeSubfolders, setIncludeSubfolders] = useState(true);
  const [preserveStructure, setPreserveStructure] = useState(true);
  const [pathError, setPathError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);

  // File selection state
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);

  // Preview data
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);

  // Import results
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const resetState = () => {
    setView("input");
    setFolderPath("");
    setIncludeSubfolders(true);
    setPreserveStructure(true);
    setPathError(null);
    setPreviewData(null);
    setImportResult(null);
    setIsLoading(false);
    setSelectedFiles([]);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  // Determine file type from extension
  const getFileType = (filename: string): SelectedFile["type"] => {
    const ext = filename.toLowerCase().split(".").pop() || "";
    if (["md", "markdown"].includes(ext)) return "markdown";
    if (["txt", "text"].includes(ext)) return "text";
    if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext)) return "image";
    return "other";
  };

  // Handle file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles: SelectedFile[] = [];

    for (const file of Array.from(files)) {
      const type = getFileType(file.name);
      const selectedFile: SelectedFile = { file, type };

      // For images, create a preview
      if (type === "image") {
        selectedFile.preview = URL.createObjectURL(file);
      }

      newFiles.push(selectedFile);
    }

    setSelectedFiles((prev) => [...prev, ...newFiles]);

    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Remove a selected file
  const removeFile = (index: number) => {
    setSelectedFiles((prev) => {
      const newFiles = [...prev];
      // Revoke object URL if it's an image
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview!);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  // Import selected files
  const handleImportFiles = async () => {
    if (selectedFiles.length === 0) return;

    setView("importing");
    const results: ImportResult = {
      success: 0,
      failed: 0,
      folders_created: 0,
      imported: [],
      errors: [],
    };

    for (const selectedFile of selectedFiles) {
      try {
        const { file, type } = selectedFile;

        if (type === "markdown" || type === "text") {
          // Read file content
          const content = await file.text();

          // Create note
          const note = await api.createNote({
            title: file.name.replace(/\.(md|markdown|txt|text)$/i, ""),
            content: content,
            tags: [],
          });

          results.imported.push({
            id: note.id,
            title: note.title,
            filename: file.name,
          });
          results.success++;
        } else if (type === "image") {
          // Convert image to base64 and create a note with it
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });

          // Create note with embedded image
          const note = await api.createNote({
            title: file.name.replace(/\.(png|jpg|jpeg|gif|webp|svg|bmp)$/i, ""),
            content: `![${file.name}](${base64})`,
            tags: ["image"],
          });

          results.imported.push({
            id: note.id,
            title: note.title,
            filename: file.name,
          });
          results.success++;
        } else {
          // Unsupported file type
          results.errors.push({
            filename: file.name,
            error: `Unsupported file type: ${file.type || "unknown"}`,
          });
          results.failed++;
        }
      } catch (error) {
        results.errors.push({
          filename: selectedFile.file.name,
          error: error instanceof Error ? error.message : "Import failed",
        });
        results.failed++;
      }
    }

    setImportResult(results);
    setView("complete");

    toast({
      title: "Import complete!",
      description: `Imported ${results.success} files${results.failed > 0 ? `, ${results.failed} failed` : ""}`,
    });

    if (onImportComplete) {
      onImportComplete();
    }
  };

  // Folder preview
  const handlePreview = async () => {
    if (!folderPath.trim()) {
      setPathError("Please enter a folder path");
      return;
    }

    setIsLoading(true);
    setPathError(null);

    try {
      const preview = await api.previewVaultImport(folderPath, includeSubfolders);
      setPreviewData(preview);
      setView("preview");
    } catch (error) {
      setPathError(
        error instanceof Error ? error.message : "Failed to access folder"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Folder import
  const handleImport = async () => {
    setView("importing");

    try {
      const result = await api.importFromVault({
        folder_path: folderPath,
        include_subfolders: includeSubfolders,
        preserve_structure: preserveStructure,
      });

      setImportResult(result);
      setView("complete");

      toast({
        title: "Import complete!",
        description: `Imported ${result.success} notes${
          result.folders_created > 0
            ? ` and created ${result.folders_created} folders`
            : ""
        }`,
      });

      if (onImportComplete) {
        onImportComplete();
      }
    } catch (error) {
      toast({
        title: "Import failed",
        description:
          error instanceof Error ? error.message : "Failed to import files",
        variant: "destructive",
      });
      setView("preview");
    }
  };

  const getFileIcon = (type: SelectedFile["type"]) => {
    switch (type) {
      case "markdown":
        return <FileText className="w-4 h-4 text-blue-500" />;
      case "text":
        return <File className="w-4 h-4 text-gray-500" />;
      case "image":
        return <Image className="w-4 h-4 text-green-500" />;
      default:
        return <File className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const renderInputView = () => (
    <div className="space-y-4">
      <Tabs value={importMode} onValueChange={(v) => setImportMode(v as ImportMode)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="files">Select Files</TabsTrigger>
          <TabsTrigger value="folder">From Folder</TabsTrigger>
        </TabsList>

        <TabsContent value="files" className="space-y-4 mt-4">
          <div className="text-center py-4">
            <Upload className="w-12 h-12 mx-auto mb-4 text-primary" />
            <h3 className="text-lg font-semibold mb-2">Select Files to Import</h3>
            <p className="text-sm text-muted-foreground">
              Import markdown (.md), text (.txt), or images directly
            </p>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".md,.markdown,.txt,.text,.png,.jpg,.jpeg,.gif,.webp,.svg,.bmp"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Select files button */}
          <Button
            variant="outline"
            className="w-full h-24 border-dashed border-2"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="text-center">
              <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
              <span className="text-sm">Click to select files</span>
              <p className="text-xs text-muted-foreground mt-1">
                .md, .txt, and images supported
              </p>
            </div>
          </Button>

          {/* Selected files list */}
          {selectedFiles.length > 0 && (
            <div className="border rounded-lg max-h-48 overflow-y-auto">
              <div className="p-2 border-b bg-muted/50 sticky top-0">
                <span className="text-sm font-medium">
                  {selectedFiles.length} file{selectedFiles.length !== 1 ? "s" : ""} selected
                </span>
              </div>
              <ul className="divide-y">
                {selectedFiles.map((sf, index) => (
                  <li
                    key={index}
                    className="px-3 py-2 text-sm flex items-center gap-2"
                  >
                    {sf.preview ? (
                      <img
                        src={sf.preview}
                        alt={sf.file.name}
                        className="w-8 h-8 object-cover rounded"
                      />
                    ) : (
                      getFileIcon(sf.type)
                    )}
                    <span className="flex-1 truncate">{sf.file.name}</span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {sf.type}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeFile(index)}
                    >
                      ×
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleImportFiles}
              disabled={isLoading || selectedFiles.length === 0}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Import {selectedFiles.length} File{selectedFiles.length !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="folder" className="space-y-4 mt-4">
          <div className="text-center py-4">
            <FolderOpen className="w-12 h-12 mx-auto mb-4 text-primary" />
            <h3 className="text-lg font-semibold mb-2">Import from Folder</h3>
            <p className="text-sm text-muted-foreground">
              Import all .md files from a folder, including Obsidian vaults
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="folder-path">Folder Path</Label>
              <div className="flex gap-2">
                <Input
                  id="folder-path"
                  type="text"
                  placeholder="C:/Users/.../MyVault or paste path here"
                  value={folderPath}
                  onChange={(e) => {
                    setFolderPath(e.target.value);
                    setPathError(null);
                  }}
                  className={`flex-1 ${pathError ? "border-destructive" : ""}`}
                />
                <Button
                  variant="outline"
                  onClick={() => setBrowserOpen(true)}
                  title="Browse for folder"
                >
                  <FolderSearch className="w-4 h-4 mr-2" />
                  Browse
                </Button>
              </div>
              {pathError && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {pathError}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Enter the full path or click Browse to navigate
              </p>
            </div>

            <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-subfolders"
                  checked={includeSubfolders}
                  onCheckedChange={(checked) =>
                    setIncludeSubfolders(checked === true)
                  }
                />
                <Label htmlFor="include-subfolders" className="text-sm font-normal cursor-pointer">
                  Include subfolders
                </Label>
              </div>
              <p className="text-xs text-muted-foreground ml-6">
                Scan nested folders for .md files
              </p>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="preserve-structure"
                  checked={preserveStructure}
                  onCheckedChange={(checked) =>
                    setPreserveStructure(checked === true)
                  }
                />
                <Label htmlFor="preserve-structure" className="text-sm font-normal cursor-pointer">
                  Preserve folder structure
                </Label>
              </div>
              <p className="text-xs text-muted-foreground ml-6">
                Create matching folders in MyOb
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handlePreview} disabled={isLoading || !folderPath.trim()}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <FolderOpen className="w-4 h-4 mr-2" />
                  Preview Import
                </>
              )}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );

  const renderPreviewView = () => {
    if (!previewData) return null;

    return (
      <div className="space-y-6">
        <div className="text-center py-2">
          <h3 className="text-lg font-semibold mb-2">Preview Import</h3>
          <p className="text-sm text-muted-foreground">{folderPath}</p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="border rounded-lg p-4 text-center">
            <FileText className="w-8 h-8 mx-auto mb-2 text-primary" />
            <div className="text-2xl font-bold">{previewData.file_count}</div>
            <div className="text-sm text-muted-foreground">
              {previewData.file_count === 1 ? "File" : "Files"} to import
            </div>
          </div>
          <div className="border rounded-lg p-4 text-center">
            <FolderPlus className="w-8 h-8 mx-auto mb-2 text-primary" />
            <div className="text-2xl font-bold">{previewData.folder_count}</div>
            <div className="text-sm text-muted-foreground">
              {previewData.folder_count === 1 ? "Folder" : "Folders"} to create
            </div>
          </div>
        </div>

        {/* File list preview */}
        {previewData.files.length > 0 && (
          <div className="border rounded-lg max-h-48 overflow-y-auto">
            <div className="p-2 border-b bg-muted/50 sticky top-0">
              <span className="text-sm font-medium">Files to import</span>
            </div>
            <ul className="divide-y">
              {previewData.files.map((file, index) => (
                <li
                  key={index}
                  className="px-3 py-2 text-sm flex items-center gap-2"
                >
                  <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="truncate">{file.path}</span>
                </li>
              ))}
            </ul>
            {previewData.has_more && (
              <div className="p-2 text-center text-sm text-muted-foreground border-t">
                And {previewData.file_count - 50} more files...
              </div>
            )}
          </div>
        )}

        {previewData.file_count === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No markdown files found in this folder</p>
          </div>
        )}

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setView("input")}>
            Back
          </Button>
          <Button
            onClick={handleImport}
            disabled={previewData.file_count === 0}
          >
            Import {previewData.file_count}{" "}
            {previewData.file_count === 1 ? "File" : "Files"}
          </Button>
        </div>
      </div>
    );
  };

  const renderImportingView = () => (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="w-12 h-12 mb-4 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      <h3 className="text-lg font-semibold mb-2">Importing Files...</h3>
      <p className="text-sm text-muted-foreground">
        This may take a moment for large imports
      </p>
    </div>
  );

  const renderCompleteView = () => {
    if (!importResult) return null;

    return (
      <div className="space-y-6 text-center">
        <div className="py-4">
          {importResult.failed === 0 ? (
            <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-500" />
          ) : (
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-amber-500" />
          )}
          <h3 className="text-2xl font-bold mb-2">Import Complete!</h3>
          <p className="text-muted-foreground">
            Successfully imported {importResult.success} of{" "}
            {importResult.success + importResult.failed} files
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="border rounded-lg p-3">
            <div className="text-xl font-bold text-green-600">
              {importResult.success}
            </div>
            <div className="text-xs text-muted-foreground">Imported</div>
          </div>
          <div className="border rounded-lg p-3">
            <div className="text-xl font-bold text-primary">
              {importResult.folders_created}
            </div>
            <div className="text-xs text-muted-foreground">Folders</div>
          </div>
          <div className="border rounded-lg p-3">
            <div className="text-xl font-bold text-red-600">
              {importResult.failed}
            </div>
            <div className="text-xs text-muted-foreground">Failed</div>
          </div>
        </div>

        {importResult.errors.length > 0 && (
          <div className="border border-destructive/50 rounded-lg p-3 text-left max-h-32 overflow-y-auto">
            <p className="text-sm font-medium text-destructive mb-2">Errors:</p>
            <ul className="text-xs space-y-1">
              {importResult.errors.map((err, i) => (
                <li key={i} className="text-muted-foreground">
                  {err.filename}: {err.error}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Button onClick={handleClose} className="w-full">
          Done
        </Button>
      </div>
    );
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {view === "input" && "Import Files"}
              {view === "preview" && "Preview Import"}
              {view === "importing" && "Importing..."}
              {view === "complete" && "Import Complete"}
            </DialogTitle>
          </DialogHeader>

          <div className="mt-4">
            {view === "input" && renderInputView()}
            {view === "preview" && renderPreviewView()}
            {view === "importing" && renderImportingView()}
            {view === "complete" && renderCompleteView()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Folder Browser Dialog */}
      <FolderBrowserDialog
        isOpen={browserOpen}
        onClose={() => setBrowserOpen(false)}
        onSelect={(path) => {
          setFolderPath(path);
          setPathError(null);
        }}
        initialPath={folderPath || undefined}
      />
    </>
  );
}
