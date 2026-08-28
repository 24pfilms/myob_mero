import { User, Sparkles } from "lucide-react";
import { CitationCard } from "./CitationCard";
import ReactMarkdown from "react-markdown";

interface Citation {
  noteId: string;
  noteTitle: string;
  excerpt: string;
  relevanceScore: number;
}

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  timestamp: Date;
  onCitationClick: (noteId: string) => void;
}

export const ChatMessage = ({
  role,
  content,
  citations,
  timestamp,
  onCitationClick,
}: ChatMessageProps) => {
  const isUser = role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      {!isUser && (
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
        </div>
      )}

      <div className={`flex flex-col gap-2 max-w-[80%] ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`rounded-2xl px-4 py-2 ${
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted"
          }`}
        >
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap">{content}</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="text-sm mb-2 last:mb-0">{children}</p>,
                  a: ({ children, href }) => (
                    <a
                      href={href}
                      className="text-primary hover:underline"
                      onClick={(e) => {
                        // Check if it's a wiki link [[Note Title]]
                        if (href?.startsWith("[[") && href?.endsWith("]]")) {
                          e.preventDefault();
                          // Extract noteId if available in citations
                          const title = href.slice(2, -2);
                          const citation = citations?.find(c => c.noteTitle === title);
                          if (citation) {
                            onCitationClick(citation.noteId);
                          }
                        }
                      }}
                    >
                      {children}
                    </a>
                  ),
                  ul: ({ children }) => <ul className="list-disc list-inside text-sm space-y-1">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside text-sm space-y-1">{children}</ol>,
                  code: ({ children, className }) => {
                    const isInline = !className;
                    return isInline ? (
                      <code className="bg-muted px-1 py-0.5 rounded text-xs">{children}</code>
                    ) : (
                      <code className={className}>{children}</code>
                    );
                  },
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Citations */}
        {!isUser && citations && citations.length > 0 && (
          <div className="space-y-2 w-full">
            <p className="text-xs text-muted-foreground px-2">Sources:</p>
            {citations.map((citation, index) => (
              <CitationCard
                key={`${citation.noteId}-${index}`}
                noteId={citation.noteId}
                noteTitle={citation.noteTitle}
                excerpt={citation.excerpt}
                relevanceScore={citation.relevanceScore}
                onClick={onCitationClick}
              />
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground px-2">
          {timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>

      {isUser && (
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <User className="w-4 h-4" />
          </div>
        </div>
      )}
    </div>
  );
};
