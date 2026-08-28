import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  FileText,
  Eye,
  Pencil,
  Columns2,
  Save,
  Command,
  Sparkles,
  PanelLeftClose,
  PanelLeft,
  Image,
  Loader2,
} from "lucide-react";

interface EditorToolbarProps {
  viewMode: 'edit' | 'preview' | 'split';
  onViewModeChange: (mode: 'edit' | 'preview' | 'split') => void;
  onSave: () => void;
  onCommandPalette: () => void;
  onAIAssist?: () => void;
  onGenerateImage?: () => void;
  hasUnsavedChanges?: boolean;
  isSaving?: boolean;
  sidebarOpen: boolean;
  onSidebarToggle: () => void;
  appName?: string;
}

export const EditorToolbar = ({
  viewMode,
  onViewModeChange,
  onSave,
  onCommandPalette,
  onAIAssist,
  onGenerateImage,
  hasUnsavedChanges = false,
  isSaving = false,
  sidebarOpen,
  onSidebarToggle,
  appName = 'MyOb',
}: EditorToolbarProps) => {
  return (
    <div className="h-14 border-b border-border bg-gradient-to-r from-background/95 to-muted/20 backdrop-blur-md flex items-center justify-between px-4 shadow-sm">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onSidebarToggle}
          className="gap-2"
        >
          {sidebarOpen ? (
            <PanelLeftClose className="w-4 h-4 text-primary" />
          ) : (
            <PanelLeft className="w-4 h-4 text-primary" />
          )}
        </Button>
        
        <Separator orientation="vertical" className="h-6" />
        
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <span className="font-semibold text-foreground">{appName}</span>
        </div>
        
        <Separator orientation="vertical" className="h-6" />
        
        {/* View Mode Buttons */}
        <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1 border border-border/50 shadow-sm">
          <Button
            variant={viewMode === 'edit' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('edit')}
            className="gap-2"
            title="Edit mode"
          >
            <Pencil className="w-4 h-4 text-primary" />
            <span className="hidden sm:inline">Edit</span>
          </Button>
          <Button
            variant={viewMode === 'preview' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('preview')}
            className="gap-2"
            title="Preview mode"
          >
            <Eye className="w-4 h-4 text-primary" />
            <span className="hidden sm:inline">Preview</span>
          </Button>
          <Button
            variant={viewMode === 'split' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('split')}
            className="gap-2"
            title="Split view (Ctrl+E to cycle)"
          >
            <Columns2 className="w-4 h-4 text-primary" />
            <span className="hidden sm:inline">Split</span>
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button 
          variant="ghost" 
          size="sm" 
          className="gap-2"
          onClick={onAIAssist}
          disabled={!onAIAssist}
        >
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="hidden sm:inline">AI Assist</span>
        </Button>
        
        <Button 
          variant="ghost" 
          size="sm" 
          className="gap-2"
          onClick={onGenerateImage}
          disabled={!onGenerateImage}
          title="Generate AI Image (Gemini 2.5 Flash)"
        >
          <Image className="w-4 h-4 text-primary" />
          <span className="hidden sm:inline">Generate</span>
        </Button>
        
        <Separator orientation="vertical" className="h-6" />
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onCommandPalette}
          className="gap-2"
        >
          <Command className="w-4 h-4 text-primary" />
          <span className="hidden sm:inline">Commands</span>
        </Button>
        
        <Button
          variant={hasUnsavedChanges ? 'default' : 'ghost'}
          size="sm"
          onClick={onSave}
          className="gap-2"
          disabled={isSaving}
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4 text-primary" />
          )}
          <span className="hidden sm:inline">
            {isSaving ? 'Saving...' : hasUnsavedChanges ? 'Save' : 'Saved'}
          </span>
        </Button>
      </div>
    </div>
  );
};
