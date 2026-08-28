import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, Link as LinkIcon, X } from "lucide-react"
import { parseUrlTextFile, isValidUrl, detectContentType } from "@/lib/urlFileParser"
import type { ParsedUrlItem } from "@/lib/urlFileParser"
import { api } from "@/lib/api"
import type { Folder } from "@/lib/api"
import { FilePreview } from "./FilePreview"
import { ImportOptions, ImportOptionsData } from "./ImportOptions"
import { ImportProgress } from "./ImportProgress"
import { useToast } from "@/hooks/use-toast"

interface ImportHotspotProps {
  isOpen: boolean
  onClose: () => void
  onImportComplete?: (noteId?: string) => void
}

type ViewState = 'input' | 'preview' | 'configure' | 'progress' | 'complete'

export function ImportHotspot({ isOpen, onClose, onImportComplete }: ImportHotspotProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // State
  const [view, setView] = useState<ViewState>('input')
  const [dragActive, setDragActive] = useState(false)
  const [url, setUrl] = useState('')
  const [customTitle, setCustomTitle] = useState('')
  const [urlError, setUrlError] = useState<string | null>(null)
  
  // File import state
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsedItems, setParsedItems] = useState<ParsedUrlItem[]>([])
  
  // Import options
  const [folders, setFolders] = useState<Folder[]>([])
  const [options, setOptions] = useState<ImportOptionsData>({
    generateSummary: true,
    summaryLength: 'brief',
    autoTag: true,
    folderId: null,
  })
  
  // Progress tracking
  const [jobId, setJobId] = useState<string | null>(null)
  const [importResults, setImportResults] = useState<any>(null)

  // Load folders on mount
  useEffect(() => {
    if (isOpen) {
      loadFolders()
    }
  }, [isOpen])

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      resetState()
    }
  }, [isOpen])

  const resetState = () => {
    setView('input')
    setUrl('')
    setCustomTitle('')
    setUrlError(null)
    setFileName(null)
    setParsedItems([])
    setJobId(null)
    setImportResults(null)
    setDragActive(false)
  }

  const loadFolders = async () => {
    try {
      const foldersList = await api.getFolders()
      setFolders(foldersList)
    } catch (error) {
      console.error('Failed to load folders:', error)
    }
  }

  // File drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = Array.from(e.dataTransfer.files)
    const txtFile = files.find(f => f.name.endsWith('.txt'))

    if (!txtFile) {
      toast({
        title: "Invalid file",
        description: "Please drop a .txt file containing URLs",
        variant: "destructive",
      })
      return
    }

    await handleFileSelect(txtFile)
  }

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      await handleFileSelect(file)
    }
  }

  const handleFileSelect = async (file: File) => {
    try {
      const content = await file.text()
      const items = parseUrlTextFile(content)

      if (items.length === 0) {
        toast({
          title: "No URLs found",
          description: "The file doesn't contain any valid URLs",
          variant: "destructive",
        })
        return
      }

      setFileName(file.name)
      setParsedItems(items)
      setView('preview')
    } catch (error) {
      toast({
        title: "File parsing failed",
        description: error instanceof Error ? error.message : "Failed to parse file",
        variant: "destructive",
      })
    }
  }

  // URL paste handlers
  const handleUrlChange = (value: string) => {
    setUrl(value)
    setUrlError(null)

    if (value && !isValidUrl(value)) {
      setUrlError("Please enter a valid URL starting with http:// or https://")
    }
  }

  const handleQuickImport = async () => {
    if (!url || !isValidUrl(url)) {
      setUrlError("Please enter a valid URL")
      return
    }

    setView('progress')

    try {
      const result = await api.importContentQuick({
        url,
        custom_title: customTitle || undefined,
        folder_id: options.folderId,
        generate_summary: options.generateSummary,
        summary_length: options.summaryLength,
        auto_tag: options.autoTag,
      })

      setImportResults({
        status: 'completed',
        total: 1,
        completed: 1,
        failed: 0,
        results: [{
          url,
          status: 'success',
          note_id: result.note_id,
          title: result.title,
          content_type: result.content_type,
          transcript_available: result.transcript_available,
        }]
      })
      setView('complete')

      // Show context-aware toast message
      const isYouTube = result.content_type === 'youtube'
      const hasTranscript = result.transcript_available !== false
      
      if (isYouTube && !hasTranscript) {
        toast({
          title: "YouTube video imported",
          description: `Created note for "${result.title}" (transcript not available)`,
          variant: "default",
        })
      } else {
        toast({
          title: "Import successful!",
          description: `Created note: ${result.title}`,
        })
      }

    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Failed to import URL",
        variant: "destructive",
      })
      setView('input')
    }
  }

  const handleBulkImport = async () => {
    if (parsedItems.length === 0) return

    setView('progress')

    try {
      const result = await api.importContentBulk({
        items: parsedItems,
        folder_id: options.folderId,
        generate_summary: options.generateSummary,
        summary_length: options.summaryLength,
        auto_tag: options.autoTag,
      })

      setJobId(result.job_id)

    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Failed to start import",
        variant: "destructive",
      })
      setView('configure')
    }
  }

  const handleImportComplete = (results: any) => {
    setImportResults(results)
    setView('complete')

    const succeeded = results.completed - results.failed
    toast({
      title: "Import complete!",
      description: `Successfully imported ${succeeded} of ${results.total} items`,
    })

    if (onImportComplete) {
      onImportComplete()
    }
  }

  const handleClose = () => {
    resetState()
    onClose()
  }

  // Render different views
  const renderInputView = () => (
    <div className="space-y-6">
      {/* File Drop Zone */}
      <div
        className={`
          border-2 border-dashed rounded-lg p-12 text-center
          transition-all duration-200 cursor-pointer
          ${dragActive 
            ? 'border-primary bg-primary/10 scale-105' 
            : 'border-border hover:border-primary/50 hover:bg-accent/50'
          }
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className={`w-12 h-12 mx-auto mb-4 ${dragActive ? 'text-primary' : 'text-muted-foreground'}`} />
        <h3 className="text-lg font-semibold mb-2">
          {dragActive ? '⬇️ Drop File Now' : '🎯 Drop Text File Here'}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Drag & drop your .txt file with URLs<br />
          or click to browse
        </p>
        <Button variant="outline" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}>
          <Upload className="w-4 h-4 mr-2" />
          Choose File
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt"
          className="hidden"
          onChange={handleFileInputChange}
        />
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">OR</span>
        </div>
      </div>

      {/* URL Paste Box */}
      <div className="border rounded-lg p-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="url-input" className="text-sm font-medium">
            📋 Paste URL here (Ctrl+V)
          </Label>
          <Input
            id="url-input"
            type="url"
            placeholder="https://youtube.com/..."
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
            className={urlError ? "border-destructive" : ""}
          />
          {urlError && (
            <p className="text-sm text-destructive">{urlError}</p>
          )}
          {url && isValidUrl(url) && (
            <p className="text-sm text-muted-foreground">
              ✓ {detectContentType(url)} detected
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="custom-title" className="text-sm font-medium">
            Custom Title (optional)
          </Label>
          <Input
            id="custom-title"
            type="text"
            placeholder="My Custom Title"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
          />
        </div>

        <Button
          className="w-full"
          onClick={handleQuickImport}
          disabled={!url || !isValidUrl(url)}
        >
          <LinkIcon className="w-4 h-4 mr-2" />
          Import Single URL
        </Button>
      </div>
    </div>
  )

  const renderPreviewView = () => (
    <FilePreview
      fileName={fileName || ''}
      items={parsedItems}
      onBack={() => setView('input')}
      onContinue={() => setView('configure')}
    />
  )

  const renderConfigureView = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Configure Import</h3>
        <p className="text-sm text-muted-foreground">
          Importing {parsedItems.length} {parsedItems.length === 1 ? 'URL' : 'URLs'}
        </p>
      </div>

      <ImportOptions
        options={options}
        folders={folders}
        onChange={setOptions}
      />

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setView('preview')}>
          Back
        </Button>
        <Button onClick={handleBulkImport}>
          Import {parsedItems.length} {parsedItems.length === 1 ? 'URL' : 'URLs'}
        </Button>
      </div>
    </div>
  )

  const renderProgressView = () => {
    if (!jobId) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="text-6xl mb-4">⏳</div>
            <p className="text-lg font-medium">Starting import...</p>
          </div>
        </div>
      )
    }

    return (
      <ImportProgress
        jobId={jobId}
        totalItems={parsedItems.length}
        onComplete={handleImportComplete}
      />
    )
  }

  const renderCompleteView = () => {
    if (!importResults) return null

    const succeeded = importResults.completed - importResults.failed
    
    // Check if any YouTube videos were imported without transcripts
    const youtubeNoTranscript = importResults.results?.filter(
      (r: any) => r.status === 'success' && r.content_type === 'youtube' && r.transcript_available === false
    ) || []

    return (
      <div className="space-y-6 text-center">
        <div className="text-6xl mb-4">
          {importResults.failed === 0 ? '✅' : '⚠️'}
        </div>
        <div>
          <h3 className="text-2xl font-bold mb-2">
            Import {importResults.status === 'completed' ? 'Complete!' : 'Finished'}
          </h3>
          <p className="text-muted-foreground">
            Successfully imported {succeeded} of {importResults.total} {importResults.total === 1 ? 'item' : 'items'}
          </p>
        </div>

        {youtubeNoTranscript.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-lg">📹</span>
              <div className="text-left flex-1">
                <p className="font-medium text-amber-900 dark:text-amber-100 mb-1">
                  YouTube {youtubeNoTranscript.length === 1 ? 'video' : 'videos'} imported without transcript
                </p>
                <p className="text-amber-700 dark:text-amber-300 text-xs">
                  {youtubeNoTranscript.length === 1 ? 'This video note' : 'These video notes'} contain instructions for manually adding transcripts.
                </p>
              </div>
            </div>
          </div>
        )}

        {importResults.failed > 0 && (
          <div className="text-sm text-destructive">
            {importResults.failed} {importResults.failed === 1 ? 'item' : 'items'} failed
          </div>
        )}

        <div className="flex justify-center gap-3">
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
          <Button onClick={() => {
            // Get the first successfully imported note ID
            const firstSuccess = importResults.results.find((r: any) => r.status === 'success' && r.note_id)
            handleClose()
            if (onImportComplete && firstSuccess) {
              onImportComplete(firstSuccess.note_id)
            } else if (onImportComplete) {
              onImportComplete()
            }
          }}>
            View Notes
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>
              {view === 'input' && 'Import Content Hotspot'}
              {view === 'preview' && 'Preview URLs'}
              {view === 'configure' && 'Import Options'}
              {view === 'progress' && 'Importing...'}
              {view === 'complete' && 'Import Complete'}
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="mt-4">
          {view === 'input' && renderInputView()}
          {view === 'preview' && renderPreviewView()}
          {view === 'configure' && renderConfigureView()}
          {view === 'progress' && renderProgressView()}
          {view === 'complete' && renderCompleteView()}
        </div>
      </DialogContent>
    </Dialog>
  )
}
