import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface AISettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AISettings {
  ai_chat_enabled: boolean;
  link_suggestions_enabled: boolean;
  auto_tag_enabled: boolean;
  chat_model: string;
  temperature: number;
  max_context_notes: number;
  send_full_content: boolean;
  exclude_private_tags: boolean;
  save_conversations: boolean;
  link_suggestion_debounce: number;
}

const defaultSettings: AISettings = {
  ai_chat_enabled: true,
  link_suggestions_enabled: true,
  auto_tag_enabled: false,
  chat_model: "google/gemini-2.5-flash",
  temperature: 0.7,
  max_context_notes: 5,
  send_full_content: false,
  exclude_private_tags: true,
  save_conversations: true,
  link_suggestion_debounce: 500,
};

const modelOptions = [
  { value: "google/gemini-2.5-flash", label: "Google Gemini 2.5 Flash (Default - Fastest)" },
  { value: "google/gemini-2.5-pro", label: "Google Gemini 2.5 Pro" },
  { value: "z-ai/glm-4.6", label: "GLM-4.6" },
  { value: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
  { value: "anthropic/claude-3-opus", label: "Claude 3 Opus" },
  { value: "openai/gpt-4-turbo", label: "GPT-4 Turbo" },
  { value: "openai/gpt-4", label: "GPT-4" },
  { value: "meta-llama/llama-3-70b", label: "Llama 3 70B" },
];

export const AISettingsDialog = ({ open, onOpenChange }: AISettingsDialogProps) => {
  const { toast } = useToast();
  const [settings, setSettings] = useState<AISettings>(defaultSettings);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load settings when dialog opens
  useEffect(() => {
    if (open) {
      loadSettings();
    }
  }, [open]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch("http://localhost:8001/api/ai/settings");
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error("Failed to load AI settings:", error);
      toast({
        title: "Failed to load settings",
        description: "Using default settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch("http://localhost:8001/api/ai/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        toast({
          title: "Settings saved",
          description: "Your AI preferences have been updated",
        });
        onOpenChange(false);
      } else {
        throw new Error("Failed to save settings");
      }
    } catch (error) {
      console.error("Failed to save AI settings:", error);
      toast({
        title: "Failed to save settings",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof AISettings>(key: K, value: AISettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI Assistant Settings</DialogTitle>
          <DialogDescription>
            Configure AI features and preferences for your knowledge base
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Feature Toggles */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Features</h3>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="ai-chat">AI Chat</Label>
                  <p className="text-sm text-muted-foreground">
                    Ask questions about your notes
                  </p>
                </div>
                <Switch
                  id="ai-chat"
                  checked={settings.ai_chat_enabled}
                  onCheckedChange={(checked) => updateSetting("ai_chat_enabled", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="link-suggestions">Link Suggestions</Label>
                  <p className="text-sm text-muted-foreground">
                    Show link suggestions while typing
                  </p>
                </div>
                <Switch
                  id="link-suggestions"
                  checked={settings.link_suggestions_enabled}
                  onCheckedChange={(checked) => updateSetting("link_suggestions_enabled", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-tag">Auto-Tagging</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically suggest tags for notes
                  </p>
                </div>
                <Switch
                  id="auto-tag"
                  checked={settings.auto_tag_enabled}
                  onCheckedChange={(checked) => updateSetting("auto_tag_enabled", checked)}
                />
              </div>
            </div>

            <Separator />

            {/* Model Settings */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">AI Model</h3>
              
              <div className="space-y-2">
                <Label htmlFor="model">Language Model</Label>
                <Select
                  value={settings.chat_model}
                  onValueChange={(value) => updateSetting("chat_model", value)}
                >
                  <SelectTrigger id="model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {modelOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="temperature">
                  Creativity: {settings.temperature.toFixed(1)}
                </Label>
                <Slider
                  id="temperature"
                  value={[settings.temperature]}
                  onValueChange={([value]) => updateSetting("temperature", value)}
                  min={0}
                  max={1}
                  step={0.1}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Lower = more focused, Higher = more creative
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="context-notes">
                  Context Notes: {settings.max_context_notes}
                </Label>
                <Slider
                  id="context-notes"
                  value={[settings.max_context_notes]}
                  onValueChange={([value]) => updateSetting("max_context_notes", value)}
                  min={1}
                  max={10}
                  step={1}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Number of notes to include as context
                </p>
              </div>
            </div>

            <Separator />

            {/* Privacy Settings */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Privacy</h3>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="full-content">Send Full Content</Label>
                  <p className="text-sm text-muted-foreground">
                    Send full notes vs excerpts
                  </p>
                </div>
                <Switch
                  id="full-content"
                  checked={settings.send_full_content}
                  onCheckedChange={(checked) => updateSetting("send_full_content", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="exclude-private">Exclude Private Notes</Label>
                  <p className="text-sm text-muted-foreground">
                    Don't send notes tagged #private
                  </p>
                </div>
                <Switch
                  id="exclude-private"
                  checked={settings.exclude_private_tags}
                  onCheckedChange={(checked) => updateSetting("exclude_private_tags", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="save-conv">Save Conversations</Label>
                  <p className="text-sm text-muted-foreground">
                    Keep history of AI chats
                  </p>
                </div>
                <Switch
                  id="save-conv"
                  checked={settings.save_conversations}
                  onCheckedChange={(checked) => updateSetting("save_conversations", checked)}
                />
              </div>
            </div>

            <Separator />

            {/* Performance Settings */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Performance</h3>
              
              <div className="space-y-2">
                <Label htmlFor="debounce">
                  Suggestion Delay: {settings.link_suggestion_debounce}ms
                </Label>
                <Slider
                  id="debounce"
                  value={[settings.link_suggestion_debounce]}
                  onValueChange={([value]) => updateSetting("link_suggestion_debounce", value)}
                  min={200}
                  max={2000}
                  step={100}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Wait time before showing link suggestions
                </p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={saveSettings} disabled={loading || saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
