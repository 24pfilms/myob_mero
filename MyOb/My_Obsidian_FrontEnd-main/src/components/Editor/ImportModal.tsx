import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Alert, AlertDescription } from '../ui/alert';
import { Loader2, FileText, Video, Github, Globe, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { api, Folder } from '../../lib/api';
import { useToast } from '../../hooks/use-toast';

interface ImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNoteCreated?: (noteId: string) => void;
  defaultUrl?: string;
}

interface ImportItem {
  url: string;
  customTitle?: string;
  enabled: boolean;
  contentType?: string;
}

interface JobResult {
  url: string;
  status: 'success' | 'failed';
  note_id: string | null;
  title: string | null;
  error: string | null;
}

export function ImportModal({ open, onOpenChange, onNoteCreated, defaultUrl = '' }: ImportModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'quick' | 'bulk'>('quick');
  
  // Quick Import State
  const [quickUrl, setQuickUrl] = useState(defaultUrl);
  const [quickLoading, setQuickLoading] = useState(false);
  
  // Bulk Import State
  const [bulkUrls, setBulkUrls] = useState('');
  const [bulkItems, setBulkItems] = useState<ImportItem[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<any>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  
  // Common Options
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [folders, setFolders] = useState<Folder[]>([]);
  const [generateSummary, setGenerateSummary] = useState(false);
  const [summaryLength, setSummaryLength] = useState<'brief' | 'medium' | 'detailed'>('medium');
  const [autoTag, setAutoTag] = useState(false);

  // Load folders on mount
  useEffect(() => {
    if (open) {
      loadFolders();
      if (defaultUrl) {
        setQuickUrl(defaultUrl);
      }
    }
  }, [open, defaultUrl]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  const loadFolders = async () => {
    try {
      const fetchedFolders = await api.getFolders();
      setFolders(fetchedFolders);
    } catch (error) {
      console.error('Failed to load folders:', error);
    }
  };

  const detectContentType = (url: string): string => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('github.com')) return 'github';
    if (url.endsWith('.pdf')) return 'pdf';
    return 'article';
  };

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'youtube': return <Video className="h-4 w-4" />;
      case 'github': return <Github className="h-4 w-4" />;
      case 'pdf': return <FileText className="h-4 w-4" />;
      default: return <Globe className="h-4 w-4" />;
    }
  };

  const handleQuickImport = async () => {
    if (!quickUrl.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a URL',
        variant: 'destructive',
      });
      return;
    }

    setQuickLoading(true);
    try {
      const result = await api.importContentQuick({
        url: quickUrl,
        folder_id: selectedFolder || null,
        generate_summary: generateSummary,
        summary_length: summaryLength,
        auto_tag: autoTag,
      });

      toast({
        title: 'Import Successful',
        description: `Imported: ${result.title}`,
      });

      if (onNoteCreated) {
        onNoteCreated(result.note_id);
      }

      // Reset form
      setQuickUrl('');
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Import Failed',
        description: error.message || 'Failed to import content',
        variant: 'destructive',
      });
    } finally {
      setQuickLoading(false);
    }
  };

  const parseBulkUrls = () => {
    const urls = bulkUrls
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && (line.startsWith('http://') || line.startsWith('https://')));

    const items: ImportItem[] = urls.map(url => ({
      url,
      enabled: true,
      contentType: detectContentType(url),
    }));

    setBulkItems(items);
  };

  const handleBulkImport = async () => {
    const enabledItems = bulkItems.filter(item => item.enabled);
    
    if (enabledItems.length === 0) {
      toast({
        title: 'Error',
        description: 'Please enable at least one item to import',
        variant: 'destructive',
      });
      return;
    }

    setBulkLoading(true);
    try {
      const result = await api.importContentBulk({
        items: enabledItems.map(item => ({
          url: item.url,
          custom_title: item.customTitle,
        })),
        folder_id: selectedFolder || null,
        generate_summary: generateSummary,
        summary_length: summaryLength,
        auto_tag: autoTag,
      });

      setJobId(result.job_id);
      startPolling(result.job_id);

      toast({
        title: 'Bulk Import Started',
        description: `Processing ${result.total_items} items`,
      });
    } catch (error: any) {
      toast({
        title: 'Bulk Import Failed',
        description: error.message || 'Failed to start bulk import',
        variant: 'destructive',
      });
      setBulkLoading(false);
    }
  };

  const startPolling = (id: string) => {
    const interval = setInterval(async () => {
      try {
        const status = await api.getImportJobStatus(id);
        setJobStatus(status);

        if (status.status === 'completed' || status.status === 'failed') {
          clearInterval(interval);
          setBulkLoading(false);
          
          toast({
            title: 'Bulk Import Complete',
            description: `${status.completed} succeeded, ${status.failed} failed`,
          });
        }
      } catch (error) {
        console.error('Failed to fetch job status:', error);
      }
    }, 2000);

    setPollingInterval(interval);
  };

  const toggleItem = (index: number) => {
    const newItems = [...bulkItems];
    newItems[index].enabled = !newItems[index].enabled;
    setBulkItems(newItems);
  };

  const updateItemTitle = (index: number, title: string) => {
    const newItems = [...bulkItems];
    newItems[index].customTitle = title;
    setBulkItems(newItems);
  };

  const renderJobProgress = () => {
    if (!jobStatus) return null;

    const progress = (jobStatus.completed / jobStatus.total) * 100;

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>{jobStatus.completed} / {jobStatus.total}</span>
          </div>
          <Progress value={progress} />
        </div>

        <ScrollArea className="h-64">
          <div className="space-y-2">
            {jobStatus.results.map((result: JobResult, index: number) => (
              <div key={index} className="flex items-center gap-2 p-2 rounded border">
                {result.status === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : result.status === 'failed' ? (
                  <XCircle className="h-4 w-4 text-red-500" />
                ) : (
                  <Clock className="h-4 w-4 text-yellow-500 animate-spin" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {result.title || result.url}
                  </p>
                  {result.error && (
                    <p className="text-xs text-red-500">{result.error}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Content</DialogTitle>
          <DialogDescription>
            Import content from YouTube, articles, PDFs, GitHub repos, and more
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'quick' | 'bulk')} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="quick">Quick Import</TabsTrigger>
            <TabsTrigger value="bulk">Bulk Import</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 pr-4">
            <TabsContent value="quick" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="quick-url">URL</Label>
                <Input
                  id="quick-url"
                  placeholder="https://example.com/article"
                  value={quickUrl}
                  onChange={(e) => setQuickUrl(e.target.value)}
                  disabled={quickLoading}
                />
                {quickUrl && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {getContentTypeIcon(detectContentType(quickUrl))}
                    <span>Detected: {detectContentType(quickUrl)}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="folder-select">Folder (Optional)</Label>
                <Select value={selectedFolder} onValueChange={setSelectedFolder}>
                  <SelectTrigger id="folder-select">
                    <SelectValue placeholder="Select a folder" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No folder</SelectItem>
                    {folders.map((folder) => (
                      <SelectItem key={folder.id} value={folder.id}>
                        {folder.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="generate-summary">Generate AI Summary</Label>
                <Switch
                  id="generate-summary"
                  checked={generateSummary}
                  onCheckedChange={setGenerateSummary}
                />
              </div>

              {generateSummary && (
                <div className="space-y-2">
                  <Label htmlFor="summary-length">Summary Length</Label>
                  <Select value={summaryLength} onValueChange={(v: any) => setSummaryLength(v)}>
                    <SelectTrigger id="summary-length">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="brief">Brief (1 paragraph)</SelectItem>
                      <SelectItem value="medium">Medium (2-3 paragraphs)</SelectItem>
                      <SelectItem value="detailed">Detailed (4-5 paragraphs)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex items-center justify-between">
                <Label htmlFor="auto-tag">Auto-generate Tags</Label>
                <Switch
                  id="auto-tag"
                  checked={autoTag}
                  onCheckedChange={setAutoTag}
                />
              </div>

              <Button
                className="w-full"
                onClick={handleQuickImport}
                disabled={quickLoading || !quickUrl.trim()}
              >
                {quickLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Import
              </Button>
            </TabsContent>

            <TabsContent value="bulk" className="space-y-4 mt-4">
              {!jobId ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="bulk-urls">URLs (one per line)</Label>
                    <Textarea
                      id="bulk-urls"
                      placeholder="https://example.com/article1&#10;https://example.com/article2&#10;https://github.com/user/repo"
                      value={bulkUrls}
                      onChange={(e) => setBulkUrls(e.target.value)}
                      rows={6}
                      disabled={bulkLoading}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={parseBulkUrls}
                      disabled={!bulkUrls.trim()}
                    >
                      Parse URLs
                    </Button>
                  </div>

                  {bulkItems.length > 0 && (
                    <>
                      <div className="space-y-2">
                        <Label>Items to Import ({bulkItems.filter(i => i.enabled).length}/{bulkItems.length})</Label>
                        <ScrollArea className="h-48 border rounded p-2">
                          <div className="space-y-2">
                            {bulkItems.map((item, index) => (
                              <div key={index} className="flex items-center gap-2 p-2 border rounded">
                                <input
                                  type="checkbox"
                                  checked={item.enabled}
                                  onChange={() => toggleItem(index)}
                                  className="h-4 w-4"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    {getContentTypeIcon(item.contentType || 'article')}
                                    <Badge variant="outline" className="text-xs">
                                      {item.contentType}
                                    </Badge>
                                  </div>
                                  <Input
                                    placeholder="Custom title (optional)"
                                    value={item.customTitle || ''}
                                    onChange={(e) => updateItemTitle(index, e.target.value)}
                                    className="mt-1 h-8 text-xs"
                                  />
                                  <p className="text-xs text-muted-foreground truncate mt-1">
                                    {item.url}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="bulk-folder">Folder (Optional)</Label>
                        <Select value={selectedFolder} onValueChange={setSelectedFolder}>
                          <SelectTrigger id="bulk-folder">
                            <SelectValue placeholder="Select a folder" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">No folder</SelectItem>
                            {folders.map((folder) => (
                              <SelectItem key={folder.id} value={folder.id}>
                                {folder.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center justify-between">
                        <Label>Generate AI Summaries</Label>
                        <Switch
                          checked={generateSummary}
                          onCheckedChange={setGenerateSummary}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label>Auto-generate Tags</Label>
                        <Switch
                          checked={autoTag}
                          onCheckedChange={setAutoTag}
                        />
                      </div>

                      <Button
                        className="w-full"
                        onClick={handleBulkImport}
                        disabled={bulkLoading || bulkItems.filter(i => i.enabled).length === 0}
                      >
                        {bulkLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Import {bulkItems.filter(i => i.enabled).length} Items
                      </Button>
                    </>
                  )}
                </>
              ) : (
                <>
                  {renderJobProgress()}
                  {jobStatus?.status === 'completed' && (
                    <Button
                      className="w-full"
                      onClick={() => {
                        setJobId(null);
                        setJobStatus(null);
                        setBulkItems([]);
                        setBulkUrls('');
                      }}
                    >
                      Start New Import
                    </Button>
                  )}
                </>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
