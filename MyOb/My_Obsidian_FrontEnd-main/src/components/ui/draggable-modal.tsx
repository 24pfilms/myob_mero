import { useState, useRef, useEffect, ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

interface DraggableModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
  defaultPosition?: { x: number; y: number };
  width?: string;
  height?: string;
  showDefaultHeader?: boolean; // Show simple drag header or let content provide its own
}

export const DraggableModal = ({
  isOpen,
  onClose,
  title,
  children,
  className,
  defaultPosition = { x: 100, y: 100 },
  width = "500px",
  height = "600px",
  showDefaultHeader = true,
}: DraggableModalProps) => {
  const [position, setPosition] = useState(defaultPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement>(null);

  // Load saved position from localStorage
  useEffect(() => {
    const savedPosition = localStorage.getItem("ai-modal-position");
    if (savedPosition) {
      try {
        setPosition(JSON.parse(savedPosition));
      } catch (e) {
        console.error("Failed to parse saved position", e);
      }
    }
  }, []);

  // Save position to localStorage
  useEffect(() => {
    if (isOpen) {
      localStorage.setItem("ai-modal-position", JSON.stringify(position));
    }
  }, [position, isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener("keydown", handleEscape);
      return () => window.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!modalRef.current) return;
    
    const rect = modalRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!modalRef.current) return;

      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;

      // Keep modal within viewport bounds
      const maxX = window.innerWidth - modalRef.current.offsetWidth;
      const maxY = window.innerHeight - modalRef.current.offsetHeight;

      const boundedX = Math.max(0, Math.min(newX, maxX));
      const boundedY = Math.max(0, Math.min(newY, maxY));

      setPosition({ x: boundedX, y: boundedY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  if (!isOpen) return null;

  return (
    <>
      {/* Draggable Modal */}
      <div
        ref={modalRef}
        className={cn(
          "fixed bg-background border border-border rounded-lg shadow-2xl z-[101] flex flex-col overflow-hidden",
          isDragging && "cursor-grabbing",
          className
        )}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          width,
          height,
        }}
      >
        {showDefaultHeader && (
          /* Drag Handle Header */
          <div
            className={cn(
              "px-4 py-3 border-b border-border bg-muted/30 cursor-grab select-none flex items-center justify-between",
              isDragging && "cursor-grabbing"
            )}
            onMouseDown={handleMouseDown}
          >
            <div className="flex items-center gap-2">
              {title && <h2 className="font-semibold text-lg">{title}</h2>}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Content with drag handle if no default header */}
        {!showDefaultHeader ? (
          <div
            className="cursor-grab select-none"
            onMouseDown={handleMouseDown}
          >
            {children}
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            {children}
          </div>
        )}
      </div>
    </>
  );
};
