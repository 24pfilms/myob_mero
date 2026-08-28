import { useState, useEffect, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { yaml } from '@codemirror/lang-yaml';
import { EditorView } from '@codemirror/view';
import { useTheme } from '@/components/ThemeProvider';
import { EditorWidthSlider } from './EditorWidthSlider';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { imagePreviewPlugin } from './imagePreviewPlugin';

interface EnhancedMarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  scrollLocked?: boolean;
  scrollTarget?: string;
  fontFamily?: string;
  fontSize?: number;
}

export const EnhancedMarkdownEditor = ({ 
  value, 
  onChange,
  scrollLocked = false,
  scrollTarget = 'preview',
  fontFamily = 'JetBrains Mono',
  fontSize = 14
}: EnhancedMarkdownEditorProps) => {
  const { theme } = useTheme();
  const { toast } = useToast();
  const editorViewRef = useRef<EditorView | null>(null);
  const isScrollingRef = useRef(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editorWidth, setEditorWidth] = useState<number>(() => {
    // Load from localStorage or default to 100%
    const saved = localStorage.getItem('editorWidth');
    return saved ? parseInt(saved, 10) : 100;
  });

  // Save width to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('editorWidth', editorWidth.toString());
  }, [editorWidth]);

  // Scroll synchronization - send scroll events from editor to preview
  useEffect(() => {
    if (!scrollLocked) return;
    
    // Wait for editor to be ready
    const timer = setTimeout(() => {
      const scrollDOM = editorViewRef.current?.scrollDOM;
      if (!scrollDOM) return;

      const handleScroll = () => {
        if (isScrollingRef.current) {
          isScrollingRef.current = false;
          return;
        }

        const scrollPercentage = scrollDOM.scrollTop / (scrollDOM.scrollHeight - scrollDOM.clientHeight);
        
        // Dispatch custom event to sync with preview
        window.dispatchEvent(new CustomEvent('editor-scroll', {
          detail: { scrollPercentage, source: 'editor' }
        }));
      };

      scrollDOM.addEventListener('scroll', handleScroll);
      
      return () => {
        scrollDOM.removeEventListener('scroll', handleScroll);
      };
    }, 100);

    return () => clearTimeout(timer);
  }, [scrollLocked]);

  // Listen for preview scroll events
  useEffect(() => {
    if (!scrollLocked) return;

    const handlePreviewScroll = (e: any) => {
      if (e.detail.source === 'preview' && editorViewRef.current) {
        const scrollDOM = editorViewRef.current.scrollDOM;
        if (scrollDOM) {
          isScrollingRef.current = true;
          const scrollPosition = e.detail.scrollPercentage * (scrollDOM.scrollHeight - scrollDOM.clientHeight);
          scrollDOM.scrollTop = scrollPosition;
        }
      }
    };

    window.addEventListener('preview-scroll', handlePreviewScroll);
    return () => {
      window.removeEventListener('preview-scroll', handlePreviewScroll);
    };
  }, [scrollLocked]);

  // Drag and drop file upload handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only hide if leaving the main container
    if (e.currentTarget === e.target) {
      setDragOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    setUploading(true);

    try {
      const results: string[] = [];

      for (const file of files) {
        try {
          const response = await api.uploadFile(file);

          if (response.markdown) {
            results.push(response.markdown);
          }
        } catch (error: any) {
          console.error(`Failed to upload ${file.name}:`, error);
          toast({
            title: "Upload Failed",
            description: `Failed to upload ${file.name}: ${error.message}`,
            variant: "destructive",
          });
        }
      }

      // Insert all markdown results at cursor position
      if (results.length > 0 && editorViewRef.current) {
        const view = editorViewRef.current;
        const cursor = view.state.selection.main.head;
        const markdownToInsert = results.join('\n\n');
        
        view.dispatch({
          changes: {
            from: cursor,
            insert: markdownToInsert
          },
          selection: { anchor: cursor + markdownToInsert.length }
        });

        toast({
          title: "Upload Complete",
          description: `Successfully uploaded ${results.length} file(s)`,
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Error",
        description: "An unexpected error occurred during upload",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  // Custom theme for YAML frontmatter styling and scrolling
  const customTheme = EditorView.theme({
    '.cm-line': {
      fontSize: `${fontSize}px`,
      lineHeight: '1.6',
      fontFamily: `'${fontFamily}', monospace`,
    },
    '.cm-editor': {
      fontSize: `${fontSize}px`,
      height: '100%',
    },
    '.cm-scroller': {
      overflow: 'auto !important',
      overflowY: 'scroll !important',
      maxHeight: 'none !important',
      height: '100% !important',
      fontFamily: `'${fontFamily}', monospace`,
    },
    '.cm-content': {
      padding: '12px',
      minHeight: '100%',
      whiteSpace: 'pre-wrap !important',
      wordWrap: 'break-word !important',
      overflowWrap: 'break-word !important',
      fontFamily: `'${fontFamily}', monospace`,
    },
    // Style for YAML frontmatter section
    '.cm-line:first-child': {
      fontWeight: '600',
    },
  });

  // Word wrap extension
  const wordWrapExtension = EditorView.lineWrapping;

  return (
    <div 
      className="h-full bg-editor-bg flex flex-col overflow-hidden"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dragOver && (
        <div className="absolute inset-0 z-50 bg-primary/10 border-2 border-dashed border-primary flex items-center justify-center pointer-events-none">
          <div className="bg-background/95 backdrop-blur-sm p-6 rounded-lg shadow-lg">
            <p className="text-lg font-semibold text-foreground">Drop files to insert</p>
            <p className="text-sm text-muted-foreground mt-2">Images, JSON, Code, CSV, Markdown</p>
          </div>
        </div>
      )}
      {uploading && (
        <div className="absolute inset-0 z-50 bg-background/50 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-background/95 p-6 rounded-lg shadow-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Uploading files...</p>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-auto flex justify-center relative">
        <div 
          style={{ 
            width: `${editorWidth}%`,
            maxWidth: '100%',
            transition: 'width 0.2s ease'
          }}
        >
          <CodeMirror
            value={value}
            height="calc(100vh - 56px - 33px)"
            extensions={[markdown(), yaml(), customTheme, wordWrapExtension, imagePreviewPlugin]}
            onChange={onChange}
            onCreateEditor={(view) => {
              editorViewRef.current = view;
            }}
            theme={theme === 'dark' ? 'dark' : 'light'}
            basicSetup={{
              lineNumbers: true,
              highlightActiveLineGutter: true,
              highlightSpecialChars: true,
              history: true,
              foldGutter: true,
              drawSelection: true,
              dropCursor: true,
              allowMultipleSelections: true,
              indentOnInput: true,
              syntaxHighlighting: true,
              bracketMatching: true,
              closeBrackets: true,
              autocompletion: true,
              rectangularSelection: true,
              crosshairCursor: true,
              highlightActiveLine: true,
              highlightSelectionMatches: true,
            }}
          />
        </div>
      </div>
      <EditorWidthSlider 
        onWidthChange={setEditorWidth}
        initialWidth={editorWidth}
        content={value}
      />
    </div>
  );
};
