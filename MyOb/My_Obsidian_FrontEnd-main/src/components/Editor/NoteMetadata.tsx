import { Tags } from "./Tags";
import { Badge } from "@/components/ui/badge";

interface NoteMetadataProps {
  title?: string;
  tags?: string[];
  content?: string;  // Pass content to check for YouTube no-transcript
  className?: string;
}

export const NoteMetadata = ({ title, tags, content, className = "" }: NoteMetadataProps) => {
  if (!title && (!tags || tags.length === 0)) {
    return null;
  }

  // Check if this is a YouTube video without transcript
  const isYouTubeNoTranscript = content?.includes('## Transcript Not Available') || false;

  return (
    <div className={`px-4 py-2 border-b border-border bg-muted/20 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {title && (
            <h2 className="font-medium text-foreground truncate">
              {title}
            </h2>
          )}
          {isYouTubeNoTranscript && (
            <Badge variant="outline" className="text-xs bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300">
              <span className="mr-1">📹</span>
              No Transcript
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Tags tags={tags || []} />
        </div>
      </div>
    </div>
  );
};
