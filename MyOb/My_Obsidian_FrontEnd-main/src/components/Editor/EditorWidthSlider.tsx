import { useState, useEffect } from "react";
import { Slider } from "@/components/ui/slider";
import { Maximize2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface EditorWidthSliderProps {
  onWidthChange: (width: number) => void;
  initialWidth?: number;
  content?: string;
}

export const EditorWidthSlider = ({ 
  onWidthChange,
  initialWidth = 100,
  content = ""
}: EditorWidthSliderProps) => {
  const [width, setWidth] = useState(initialWidth);

  useEffect(() => {
    setWidth(initialWidth);
  }, [initialWidth]);

  const handleSliderChange = (values: number[]) => {
    const newWidth = values[0];
    setWidth(newWidth);
    onWidthChange(newWidth);
  };

  // Calculate stats from content
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;

  return (
    <div className="flex items-center justify-between px-4 py-1.5 bg-muted/20 border-t border-border/50 text-xs">
      {/* Left side - Stats */}
      <div className="flex items-center gap-4 text-muted-foreground">
        <span>{wordCount} words</span>
        <span>{charCount} characters</span>
      </div>
      
      {/* Right side - Width slider */}
      <div className="flex items-center gap-3">
        <Separator orientation="vertical" className="h-4" />
        <Maximize2 className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">Width</span>
        <Slider
          value={[width]}
          onValueChange={handleSliderChange}
          min={40}
          max={100}
          step={5}
          className="w-24"
        />
        <span className="text-muted-foreground font-mono w-10 text-right">
          {width}%
        </span>
      </div>
    </div>
  );
};
