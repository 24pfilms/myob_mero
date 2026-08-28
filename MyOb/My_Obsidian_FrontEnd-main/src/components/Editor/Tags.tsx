import { Badge } from "@/components/ui/badge";

interface TagsProps {
  tags: string[];
  className?: string;
}

export const Tags = ({ tags, className = "" }: TagsProps) => {
  if (!tags || tags.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {tags.map((tag, index) => (
        <Badge
          key={index}
          variant="secondary"
          className="text-xs px-2 py-0.5 bg-muted/50 text-muted-foreground hover:bg-muted/80 transition-colors"
        >
          {tag.startsWith('#') ? tag : `#${tag}`}
        </Badge>
      ))}
    </div>
  );
};