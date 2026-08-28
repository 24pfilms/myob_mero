import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DraggableModal } from "@/components/ui/draggable-modal";
import {
  Send,
  Loader2,
  Save,
  Trash2,
  Settings,
  Sparkles,
  BookOpen,
  MessageSquare,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ChatMessage } from "./ChatMessage";
import { AISettingsDialog } from "./AISettingsDialog";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  timestamp: Date;
}

interface Citation {
  noteId: string;
  noteTitle: string;
  excerpt: string;
  relevanceScore: number;
}

interface AIChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentNoteId?: string;
  currentNoteContent?: string;
  onNavigateToNote: (noteId: string) => void;
}

export const AIChatModal = ({
  isOpen,
  onClose,
  currentNoteId,
  currentNoteContent,
  onNavigateToNote,
}: AIChatModalProps) => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [useVaultContext, setUseVaultContext] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]");
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Call AI chat API with or without vault context
      const endpoint = useVaultContext 
        ? "http://localhost:8000/api/ai/chat"
        : "http://localhost:8000/api/ai/general-chat";
      
      console.log('[AI Chat Modal] Mode:', useVaultContext ? 'Vault Context' : 'General Query');
      console.log('[AI Chat Modal] Calling endpoint:', endpoint);
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: userMessage.content,
          current_note_id: useVaultContext ? currentNoteId : undefined,
          conversation_history: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        if (response.status === 403) {
          toast({
            title: "AI Chat is disabled",
            description: "Enable it in settings to use this feature",
            variant: "destructive",
          });
          return;
        }
        throw new Error("Failed to get response from AI");
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.answer,
        citations: data.citations,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Failed to send message:", error);
      toast({
        title: "Failed to send message",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    toast({
      title: "Chat cleared",
      description: "Conversation history has been cleared",
    });
  };

  const saveConversation = async () => {
    if (messages.length === 0) {
      toast({
        title: "No messages to save",
        description: "Start a conversation first",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch("http://localhost:8000/api/ai/save-conversation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
            citations: m.citations || [],
          })),
          title: messages[0].content.slice(0, 50),
        }),
      });

      if (response.ok) {
        toast({
          title: "Conversation saved",
          description: "Your chat has been saved successfully",
        });
      }
    } catch (error) {
      console.error("Failed to save conversation:", error);
      toast({
        title: "Failed to save",
        description: "Could not save conversation",
        variant: "destructive",
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      <DraggableModal
        isOpen={isOpen}
        onClose={onClose}
        title="AI Assistant"
        width="600px"
        height="700px"
        defaultPosition={{ x: 100, y: 100 }}
        className="flex flex-col"
      >
        {/* Header Controls */}
        <div className="px-4 py-3 border-b border-border bg-muted/20">
          <div className="flex items-center justify-between gap-4">
            {/* Vault Context Toggle */}
            <div className="flex items-center gap-3 flex-1">
              <div className="flex items-center gap-2">
                {useVaultContext ? (
                  <BookOpen className="w-4 h-4 text-primary" />
                ) : (
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                )}
                <Label
                  htmlFor="vault-context-modal"
                  className="text-sm font-medium cursor-pointer"
                >
                  Search Vault
                </Label>
              </div>
              <Switch
                id="vault-context-modal"
                checked={useVaultContext}
                onCheckedChange={setUseVaultContext}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSettingsOpen(true)}
                title="AI Settings"
              >
                <Settings className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={saveConversation}
                disabled={messages.length === 0}
                title="Save Conversation"
              >
                <Save className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearChat}
                disabled={messages.length === 0}
                title="Clear Chat"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Mode Description */}
          <p className="text-xs text-muted-foreground mt-2">
            {useVaultContext
              ? "Searching your notes for relevant context"
              : "General AI chat without vault context"}
          </p>
        </div>

        {/* Messages Area */}
        <ScrollArea className="flex-1 px-4" ref={scrollAreaRef}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <Sparkles className="w-12 h-12 text-primary/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">AI Assistant Ready</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {useVaultContext
                  ? "Ask questions about your notes or request summaries"
                  : "Ask me anything! General knowledge, coding help, or creative ideas"}
              </p>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  role={message.role}
                  content={message.content}
                  citations={message.citations}
                  timestamp={message.timestamp}
                  onCitationClick={(noteId) => {
                    onNavigateToNote(noteId);
                    onClose();
                  }}
                />
              ))}
              {isLoading && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Thinking...</span>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Input Area */}
        <div className="px-4 py-3 border-t border-border bg-muted/20">
          <div className="flex items-end gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                useVaultContext
                  ? "Ask about your notes..."
                  : "Ask me anything..."
              }
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              size="icon"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Press Enter to send • Drag header to move window
          </p>
        </div>
      </DraggableModal>

      {/* AI Settings Dialog */}
      <AISettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
    </>
  );
};
