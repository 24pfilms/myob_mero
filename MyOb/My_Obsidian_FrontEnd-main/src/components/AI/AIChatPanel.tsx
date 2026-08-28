import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Send,
  Loader2,
  X,
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

interface AIChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentNoteId?: string;
  currentNoteContent?: string;
  onNavigateToNote: (noteId: string) => void;
}

export const AIChatPanel = ({
  isOpen,
  onClose,
  currentNoteId,
  currentNoteContent,
  onNavigateToNote,
}: AIChatPanelProps) => {
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

  // Focus input when panel opens
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
        ? "http://localhost:8001/api/ai/chat"
        : "http://localhost:8001/api/ai/general-chat";
      
      console.log('[AI Chat] Mode:', useVaultContext ? 'Vault Context' : 'General Query');
      console.log('[AI Chat] Calling endpoint:', endpoint);
      
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
      const response = await fetch("http://localhost:8001/api/ai/save-conversation", {
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose} modal={false}>
        <SheetContent side="right" className="w-full sm:w-[500px] p-0 flex flex-col" disableOverlay>
          {/* Header */}
          <SheetHeader className="px-6 py-4 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <SheetTitle>AI Assistant</SheetTitle>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSettingsOpen(true)}
                  title="Settings"
                >
                  <Settings className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={clearChat} title="Clear chat">
                  <Trash2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={saveConversation}
                  title="Save conversation"
                >
                  <Save className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <SheetDescription>
              Ask questions about your notes and get answers with citations
            </SheetDescription>
          </SheetHeader>

          {/* Query Mode Toggle */}
          <div className="px-6 py-3 bg-muted/30 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {useVaultContext ? (
                  <BookOpen className="w-4 h-4 text-primary" />
                ) : (
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                )}
                <div className="flex flex-col">
                  <Label htmlFor="vault-context" className="text-sm font-medium cursor-pointer">
                    {useVaultContext ? "Vault Context Mode" : "General Query Mode"}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {useVaultContext 
                      ? "Searching your notes for answers" 
                      : "Asking general questions without vault context"}
                  </p>
                </div>
              </div>
              <Switch
                id="vault-context"
                checked={useVaultContext}
                onCheckedChange={setUseVaultContext}
              />
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 px-6" ref={scrollAreaRef}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <Sparkles className="w-12 h-12 text-primary/20 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Start a conversation</h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Ask me anything about your notes. I'll search your vault and provide answers
                  with citations.
                </p>
                <div className="mt-6 space-y-2">
                  <p className="text-xs text-muted-foreground">Try asking:</p>
                  <div className="space-y-1">
                    <button
                      className="block text-xs text-primary hover:underline"
                      onClick={() => setInput("What are my recent notes about?")}
                    >
                      "What are my recent notes about?"
                    </button>
                    <button
                      className="block text-xs text-primary hover:underline"
                      onClick={() => setInput("Summarize my notes on [topic]")}
                    >
                      "Summarize my notes on [topic]"
                    </button>
                    <button
                      className="block text-xs text-primary hover:underline"
                      onClick={() => setInput("Find notes related to this one")}
                    >
                      "Find notes related to this one"
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-4">
                {messages.map((message) => (
                  <ChatMessage
                    key={message.id}
                    role={message.role}
                    content={message.content}
                    citations={message.citations}
                    timestamp={message.timestamp}
                    onCitationClick={onNavigateToNote}
                  />
                ))}
                {isLoading && (
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-primary" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-muted rounded-2xl px-4 py-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Thinking...</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          <Separator />

          {/* Input */}
          <div className="p-4">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask a question..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
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
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </SheetContent>
      </Sheet>
      {/* Settings Dialog */}
      <AISettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
};
