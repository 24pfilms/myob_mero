import { Card, CardContent } from "@/components/ui/card";
import { FileText, TrendingUp } from "lucide-react";

interface CitationCardProps {
  noteId: string;
  noteTitle: string;
  excerpt: string;
  relevanceScore: number;
  onClick: (noteId: string) => void;
}

export const CitationCard = ({
  noteId,
  noteTitle,
  excerpt,
  relevanceScore,
  onClick,
}: CitationCardProps) => {
  const scoreColor = relevanceScore > 0.7 ? "text-green-600" : relevanceScore > 0.5 ? "text-yellow-600" : "text-gray-600";
  const scorePercentage = Math.round(relevanceScore * 100);

  return (
    <Card
      className="cursor-pointer hover:bg-accent transition-colors border-l-4 border-l-primary/50"
      onClick={() => onClick(noteId)}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 flex-1">
            <FileText className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm truncate">{noteTitle}</h4>
              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                {excerpt}
              </p>
            </div>
          </div>
          <div className={`flex items-center gap-1 flex-shrink-0 ${scoreColor}`}>
            <TrendingUp className="w-3 h-3" />
            <span className="text-xs font-medium">{scorePercentage}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
