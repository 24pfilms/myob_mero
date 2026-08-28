import { Lock, Unlock } from "lucide-react";
import { ResizableHandle } from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ScrollLockHandleProps {
  scrollLocked: boolean;
  onScrollLockToggle: () => void;
}

export const ScrollLockHandle = ({ scrollLocked, onScrollLockToggle }: ScrollLockHandleProps) => {
  return (
    <div className="relative flex items-center justify-center">
      <ResizableHandle withHandle />
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onScrollLockToggle}
              className="absolute z-20 h-5 w-5 rounded-full bg-background/95 backdrop-blur-sm shadow-md border border-border hover:bg-accent hover:scale-110 transition-all p-0"
              style={{ 
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -140%)'
              }}
            >
              {scrollLocked ? (
                <Lock className="h-2.5 w-2.5 text-foreground" />
              ) : (
                <Unlock className="h-2.5 w-2.5 text-muted-foreground" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>{scrollLocked ? "Unlock scroll sync" : "Lock scroll sync"}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};
