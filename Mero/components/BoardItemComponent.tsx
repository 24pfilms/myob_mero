import React, { useState, useRef, useEffect } from 'react';
import { BoardItem, ItemType, ShapeType, PanZoom, DrawingTool } from '../types';
import { PlayIcon, PauseIcon, MicrophoneIcon, CheckIcon, RotateCwIcon } from './icons';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { ObsidianNoteComponent } from './ObsidianNoteComponent';
import { NoteCard } from './NoteCard';

interface BoardItemComponentProps {
  item: BoardItem;
  isSelected: boolean;
  isGenerating: boolean;
  isInteractive: boolean;
  panZoom: PanZoom;
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>, itemId: string) => void;
  onDoubleClick: (e: React.MouseEvent<HTMLDivElement>, itemId: string) => void;
  isEditing: boolean;
  onTextChange: (itemId: string, newText: string) => void;
  onResizeMouseDown: (e: React.MouseEvent, itemId: string, handle: string) => void;
  onRotationMouseDown: (e: React.MouseEvent, itemId: string) => void;
  // Drawing tools
  drawingTool?: DrawingTool;
  onUpdateDrawing?: (drawingData: string | undefined) => void;
}

const itemBaseStyle = "absolute select-none rounded-lg";

// Additional style for better alpha compositing
const alphaCompositeStyle: React.CSSProperties = {
  // Improve alpha channel rendering
  imageRendering: 'pixelated', // Alternative to crisp-edges for some browsers
  // Ensure proper stacking
  isolation: 'isolate',
  // Prevent blending issues
  mixBlendMode: 'normal',
  // Hardware acceleration for smoother rendering
  willChange: 'transform',
};
const itemSelectedStyle = "outline outline-1 outline-blue-500 outline-offset-1";
const itemEditingStyle = "cursor-text";

const ShapeElement: React.FC<{shape: ShapeType, width: number, height: number, id: string} & React.SVGProps<SVGElement>> = ({shape, width, height, id, ...props}) => {
    const componentProps = props as any;
    const isLineOrArrow = [ShapeType.Line, ShapeType.ArrowUp, ShapeType.ArrowRight, ShapeType.ArrowDown, ShapeType.ArrowLeft, ShapeType.ArrowBoth].includes(shape);
    
    if (isLineOrArrow) {
        componentProps.stroke = componentProps.fill;
        componentProps.fill = 'none';
        componentProps.strokeWidth = Math.max(2, Math.min(width, height) * 0.1, 4);
    }
    
    switch(shape) {
        case ShapeType.Rectangle:
            return <rect x="0" y="0" width={width} height={height} rx="8" ry="8" {...componentProps} />;
        case ShapeType.RoundedRectangle:
            return <rect x="0" y="0" width={width} height={height} rx={Math.min(width, height) * 0.15} {...componentProps} />;
        case ShapeType.Circle:
            return <circle cx={width/2} cy={height/2} r={Math.min(width, height) / 2} {...componentProps} />;
        case ShapeType.Triangle:
            return <path d={`M ${width / 2} 0 L ${width} ${height} L 0 ${height} Z`} strokeLinejoin="round" strokeLinecap="round" {...componentProps} />;
        case ShapeType.Diamond:
            return <path d={`M ${width / 2} 0 L ${width} ${height / 2} L ${width / 2} ${height} L 0 ${height / 2} Z`} strokeLinejoin="round" strokeLinecap="round" {...componentProps} />;
        case ShapeType.Hexagon:
            const hexPath = `M ${width * 0.25} 0 L ${width * 0.75} 0 L ${width} ${height * 0.5} L ${width * 0.75} ${height} L ${width * 0.25} ${height} L 0 ${height * 0.5} Z`;
            return <path d={hexPath} strokeLinejoin="round" strokeLinecap="round" {...componentProps} />;
        case ShapeType.Line:
            return <path d={`M 0 ${height / 2} L ${width} ${height / 2}`} {...componentProps} />;
        case ShapeType.ArrowRight:
            return <path d={`M 0 ${height / 2} L ${width} ${height / 2}`} markerEnd="url(#arrowhead)" {...componentProps} />;
        case ShapeType.ArrowLeft:
            return <path d={`M ${width} ${height / 2} L 0 ${height / 2}`} markerEnd="url(#arrowhead)" {...componentProps} />;
        case ShapeType.ArrowDown:
            return <path d={`M ${width/2} 0 L ${width/2} ${height}`} markerEnd="url(#arrowhead)" {...componentProps} />;
        case ShapeType.ArrowUp:
            return <path d={`M ${width/2} ${height} L ${width/2} 0`} markerEnd="url(#arrowhead)" {...componentProps} />;
        case ShapeType.ArrowBoth:
            return <path d={`M 0 ${height / 2} L ${width} ${height / 2}`} markerStart="url(#arrowhead)" markerEnd="url(#arrowhead)" {...componentProps} />;
    }
}

const LoadingOverlay = () => (
    <div className="absolute inset-0 bg-gray-900/80 flex items-center justify-center rounded-lg">
        <svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    </div>
);


const ResizeHandle: React.FC<{handle: string, onMouseDown: (e: React.MouseEvent) => void}> = ({ handle, onMouseDown }) => {
    const handleBaseStyle = 'absolute bg-white border-2 border-blue-500 rounded-full w-5 h-5';
    const positionStyles: { [key: string]: React.CSSProperties } = {
        'top-left': { top: '-10px', left: '-10px', cursor: 'nwse-resize', zIndex: 1, pointerEvents: 'auto' },
        'top-right': { top: '-10px', right: '-10px', cursor: 'nesw-resize', zIndex: 1, pointerEvents: 'auto' },
        'bottom-left': { bottom: '-10px', left: '-10px', cursor: 'nesw-resize', zIndex: 1, pointerEvents: 'auto' },
        'bottom-right': { bottom: '-10px', right: '-10px', cursor: 'nwse-resize', zIndex: 1, pointerEvents: 'auto' },
    };
    return <div className={handleBaseStyle} style={positionStyles[handle]} onMouseDown={onMouseDown} />;
};

const RotationHandle: React.FC<{ onMouseDown: (e: React.MouseEvent) => void }> = ({ onMouseDown }) => (
    <div 
        className="absolute w-5 h-5 flex items-center justify-center bg-blue-500 hover:bg-blue-600 rounded-full transition-colors cursor-grab active:cursor-grabbing"
        style={{ top: '-18px', right: '-18px', zIndex: 2, pointerEvents: 'auto' }}
        onMouseDown={onMouseDown}
        title="Drag to rotate"
    >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 12C4 7.58 7.58 4 12 4C14.76 4 17.2 5.36 18.7 7.5L16 10H22V4L19.5 6.5C17.6 4 14.97 2.5 12 2.5C6.75 2.5 2.5 6.75 2.5 12H4Z" fill="white"/>
            <path d="M20 12C20 16.42 16.42 20 12 20C9.24 20 6.8 18.64 5.3 16.5L8 14H2V20L4.5 17.5C6.4 20 9.03 21.5 12 21.5C17.25 21.5 21.5 17.25 21.5 12H20Z" fill="white"/>
        </svg>
    </div>
);

// Drawing overlay component - renders both existing drawing and active canvas
interface DrawingOverlayProps {
  width: number;
  height: number;
  drawingData?: string;
  drawingTool: DrawingTool;
  isSelected: boolean;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  onMouseLeave: () => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
}

// Custom white ball cursor for pen tool
const whiteBallCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Ccircle cx='6' cy='6' r='5' fill='%23ffffff' stroke='%23333' stroke-width='1'/%3E%3C/svg%3E") 6 6, crosshair`;

const DrawingOverlay: React.FC<DrawingOverlayProps> = ({
  width,
  height,
  drawingData,
  drawingTool,
  isSelected,
  canvasRef,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}) => {
  // Clear canvas immediately when drawingData is cleared (after AI edit)
  useEffect(() => {
    if (!drawingData && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  }, [drawingData, canvasRef]);
  
  // Show existing drawing as image when not actively drawing
  const showDrawingImage = drawingData && (!isSelected || !drawingTool);
  // Show canvas when selected and drawing tool is active
  const showCanvas = isSelected && drawingTool;
  
  return (
    <>
      {/* Display existing drawing as image overlay */}
      {showDrawingImage && (
        <img
          src={drawingData}
          alt=""
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ zIndex: 5 }}
        />
      )}
      
      {/* Drawing canvas - only shown when drawing tool is active */}
      {showCanvas && (
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="absolute inset-0 touch-none select-none"
          style={{ 
            zIndex: 10, 
            cursor: drawingTool === 'pen' ? whiteBallCursor : 'cell',
            pointerEvents: 'auto',
          }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        />
      )}
    </>
  );
};


export const BoardItemComponent: React.FC<BoardItemComponentProps> = ({ item, isSelected, isGenerating, isInteractive, panZoom, onMouseDown, onDoubleClick, isEditing, onTextChange, onResizeMouseDown, onRotationMouseDown, drawingTool, onUpdateDrawing }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  
  // Drawing canvas state
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingCtx, setDrawingCtx] = useState<CanvasRenderingContext2D | null>(null);
  const drawingHistoryRef = useRef<ImageData[]>([]);
  
  // Initialize drawing canvas when item is selected and drawing tool is active
  useEffect(() => {
    if (drawingCanvasRef.current && isSelected && drawingTool) {
      const canvas = drawingCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        setDrawingCtx(ctx);
        
        // Load existing drawing data if available
        if (item.drawingData) {
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, 0, 0);
          };
          img.src = item.drawingData;
        }
      }
    }
  }, [isSelected, drawingTool, item.width, item.height]);
  
  // Track previous src to detect AI edit completion
  const prevSrcRef = useRef(item.src);
  
  // Clear canvas ONLY when src changes (new AI-edited image returned)
  useEffect(() => {
    if (prevSrcRef.current !== item.src) {
      prevSrcRef.current = item.src;
      // Clear the canvas
      if (drawingCanvasRef.current) {
        const ctx = drawingCanvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, drawingCanvasRef.current.width, drawingCanvasRef.current.height);
        }
      }
      // Clear the drawing data state
      if (onUpdateDrawing) {
        onUpdateDrawing(undefined);
      }
    }
  }, [item.src, onUpdateDrawing]);
  

  
  // Update drawing context based on active tool
  useEffect(() => {
    if (drawingCtx) {
      if (drawingTool === 'eraser') {
        drawingCtx.globalCompositeOperation = 'destination-out';
        drawingCtx.lineWidth = 40;
      } else if (drawingTool === 'pen') {
        drawingCtx.globalCompositeOperation = 'source-over';
        drawingCtx.strokeStyle = '#ef4444'; // Red color
        drawingCtx.lineWidth = 8; // Wider brush
        drawingCtx.lineCap = 'round';
        drawingCtx.lineJoin = 'round';
      }
    }
  }, [drawingTool, drawingCtx]);
  
  // Save drawing state for undo
  const saveDrawingState = () => {
    if (drawingCanvasRef.current && drawingCtx) {
      const data = drawingCtx.getImageData(0, 0, drawingCanvasRef.current.width, drawingCanvasRef.current.height);
      drawingHistoryRef.current.push(data);
      if (drawingHistoryRef.current.length > 20) {
        drawingHistoryRef.current.shift();
      }
    }
  };
  
  // Get coordinates from mouse/touch event
  // Accounts for zoom scaling on infinite canvas
  const getDrawingCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawingCanvasRef.current) return { offsetX: 0, offsetY: 0 };
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    
    const rect = drawingCanvasRef.current.getBoundingClientRect();
    // Scale coordinates from displayed size to internal canvas size
    // This accounts for zoom transforms on the infinite canvas
    const scaleX = drawingCanvasRef.current.width / rect.width;
    const scaleY = drawingCanvasRef.current.height / rect.height;
    return {
      offsetX: (clientX - rect.left) * scaleX,
      offsetY: (clientY - rect.top) * scaleY
    };
  };
  
  // Track last point for smooth drawing
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  
  // Drawing event handlers
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawingCtx || !drawingTool) return;
    e.preventDefault();
    e.stopPropagation();
    saveDrawingState();
    setIsDrawing(true);
    const { offsetX, offsetY } = getDrawingCoordinates(e);
    lastPointRef.current = { x: offsetX, y: offsetY };
    drawingCtx.beginPath();
    drawingCtx.moveTo(offsetX, offsetY);
  };
  
  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !drawingCtx || !drawingTool || !lastPointRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const { offsetX, offsetY } = getDrawingCoordinates(e);
    
    // Smoothing factor - lower = more latency (0.3 = 30% towards target per frame)
    const smoothing = 0.3;
    const smoothX = lastPointRef.current.x + (offsetX - lastPointRef.current.x) * smoothing;
    const smoothY = lastPointRef.current.y + (offsetY - lastPointRef.current.y) * smoothing;
    
    // Use quadratic curve for smoother lines
    const midX = (lastPointRef.current.x + smoothX) / 2;
    const midY = (lastPointRef.current.y + smoothY) / 2;
    
    drawingCtx.quadraticCurveTo(lastPointRef.current.x, lastPointRef.current.y, midX, midY);
    drawingCtx.stroke();
    
    // Start new path from midpoint for continuous smooth line
    drawingCtx.beginPath();
    drawingCtx.moveTo(midX, midY);
    
    lastPointRef.current = { x: smoothX, y: smoothY };
  };
  
  const stopDrawing = () => {
    if (!drawingCtx) return;
    drawingCtx.closePath();
    setIsDrawing(false);
    lastPointRef.current = null;
    
    // Save drawing data to item
    if (drawingCanvasRef.current && onUpdateDrawing) {
      const dataUrl = drawingCanvasRef.current.toDataURL('image/png');
      // Check if canvas is empty
      const ctx = drawingCanvasRef.current.getContext('2d');
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, drawingCanvasRef.current.width, drawingCanvasRef.current.height);
        const isEmpty = !imageData.data.some((channel, index) => index % 4 === 3 && channel !== 0);
        onUpdateDrawing(isEmpty ? undefined : dataUrl);
      }
    }
  };
  
  // Clear drawing
  const clearDrawing = () => {
    if (drawingCtx && drawingCanvasRef.current) {
      saveDrawingState();
      drawingCtx.clearRect(0, 0, drawingCanvasRef.current.width, drawingCanvasRef.current.height);
      onUpdateDrawing?.(undefined);
    }
  };
  const videoRef = useRef<HTMLVideoElement>(null);
    
  const handleSpeechResult = (transcript: string) => {
    onTextChange(item.id, item.text ? `${item.text.trim()} ${transcript}` : transcript);
  };
  
  const { status, startListening, stopListening, isSupported, error: speechError } = useSpeechRecognition({ onResult: handleSpeechResult });
  const isListening = status === 'listening';
  const [isAltPressed, setIsAltPressed] = useState(false);

  // Handle Alt key for speech recognition hotkey
  useEffect(() => {
    if (!isEditing || !isSupported) {
      console.log('Alt key handler not attached:', { isEditing, isSupported });
      return;
    }

    console.log('Setting up Alt key listeners for item:', item.id);

    const handleKeyDown = (e: KeyboardEvent) => {
      console.log('KeyDown event:', {
        key: e.key,
        code: e.code,
        altKey: e.altKey,
        isListening,
        isAltPressed,
        status
      });
      
      // Check for Alt key (both left and right Alt)
      if ((e.code === 'AltLeft' || e.code === 'AltRight' || e.key === 'Alt') && !isListening && !isAltPressed) {
        console.log('Starting recording with Alt key');
        e.preventDefault();
        setIsAltPressed(true);
        startListening();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      console.log('KeyUp event:', {
        key: e.key,
        code: e.code,
        isAltPressed,
        isListening
      });
      
      // Stop recording when Alt key is released
      if ((e.code === 'AltLeft' || e.code === 'AltRight' || e.key === 'Alt') && isAltPressed) {
        console.log('Stopping recording - Alt key released');
        e.preventDefault();
        setIsAltPressed(false);
        if (isListening) {
          stopListening();
        }
      }
    };

    const handleWindowBlur = () => {
      // Stop recording if window loses focus while Alt is pressed
      if (isAltPressed && isListening) {
        console.log('Window blur - stopping recording');
        setIsAltPressed(false);
        stopListening();
      }
    };

    // Add event listeners to document for global hotkey support
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      console.log('Cleaning up Alt key listeners for item:', item.id);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [isEditing, isSupported, isListening, isAltPressed, startListening, stopListening, item.id, status]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
        if (isSelected) {
            if (video.paused) {
                video.play().catch(error => {
                    console.log("Autoplay on select was prevented by browser policy:", error);
                });
            }
        } else {
            if (!video.paused) {
                video.pause();
            }
        }
    }
  }, [isSelected]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onTextChange(item.id, e.target.value);
  };
  
  const togglePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (video) {
        if (video.paused) {
            video.play();
        } else {
            video.pause();
        }
    }
  };
    
  const renderContent = () => {
    const textStyle: React.CSSProperties = { 
        color: item.textColor || '#FFFFFF',
        lineHeight: 1.1,
        fontFamily: item.fontFamily || 'Inter, sans-serif',
    };
    
    // Apply fontSize to all text-bearing items
    if (item.fontSize) {
        let scaledFontSize = item.fontSize;
        
        // For TextBox: scale font proportionally with resize
        if (item.type === ItemType.TextBox && item.originalWidth && item.originalHeight && 
            (item.width !== item.originalWidth || item.height !== item.originalHeight)) {
            const scaleFactorX = item.width / item.originalWidth;
            const scaleFactorY = item.height / item.originalHeight;
            const scaleFactor = Math.min(scaleFactorX, scaleFactorY);
            const baseFontSize = item.originalFontSize || item.fontSize;
            scaledFontSize = baseFontSize * scaleFactor;
        }
        
        textStyle.fontSize = `${scaledFontSize}px`;
    }

    const paddingClass = (item.type === ItemType.TextBox || item.type === ItemType.Shape) ? 'p-2' : 'p-4';

    if (isEditing) {
      return (
        <div className="w-full h-full flex items-center justify-center relative">
            <textarea
              value={item.text}
              onChange={handleTextChange}
              className={`w-full bg-transparent resize-none focus:outline-none text-center ${paddingClass}`}
              style={{
                ...textStyle,
                maxHeight: '100%',
                overflow: 'auto',
              }}
              rows={Math.max(1, (item.text || '').split('\n').length)}
              autoFocus
              onBlur={(e) => {
                  const boardItem = (e.target as HTMLElement).closest('.board-item');
                  if (boardItem) {
                      (boardItem as HTMLElement).focus();
                  }
              }}
            />
            {isSupported && (
                <button
                    type="button"
                    onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        isListening ? stopListening() : startListening();
                    }}
                    className={`absolute bottom-2 right-2 p-1.5 rounded-full transition-all duration-200 text-white ${ status === 'listening' ? (isAltPressed ? 'bg-red-600 animate-pulse ring-2 ring-red-300' : 'bg-red-600 animate-pulse') : ''} ${ status === 'success' ? 'bg-green-500' : ''} ${ status === 'error' ? 'bg-red-800 cursor-not-allowed' : ''} ${ status === 'idle' ? 'bg-gray-600 hover:bg-gray-500' : ''}`}
                    title={speechError ? speechError : (isListening ? (isAltPressed ? "Release Alt to stop (hotkey active)" : "Stop listening") : "Click to record or hold Alt key")}
                >
                    {status === 'success' ? <CheckIcon /> : <MicrophoneIcon />}
                </button>
            )}
        </div>
      );
    }
    return <div className={`w-full h-full flex items-center justify-center break-words text-center whitespace-pre-wrap ${paddingClass}`} style={textStyle}>{item.text}</div>;
  };
  

  const resizeHandles = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
  // Enable rotation for all item types except Frame and ObsidianNote
  const canRotate = item.type !== ItemType.Frame && item.type !== ItemType.ObsidianNote;

  const renderWrapper = (children: React.ReactNode, extraClasses: string = '', style: React.CSSProperties = {}, _noShadow: boolean = false) => {
    // No shadows on board items (only toolbar has shadows)
    const finalClassName = `${itemBaseStyle} ${isSelected ? itemSelectedStyle : ''} ${isEditing ? itemEditingStyle : ''} ${extraClasses}`;
    
    // Keep original z-index - selection shouldn't change visual layering
    const effectiveZIndex = item.zIndex;
    
    // When drawing tool is active, freeze all objects (no drag, no resize, no rotate)
    const handleFrozenMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
      if (drawingTool) {
        e.stopPropagation();
        // Still allow selection, but don't start drag
        if (!isSelected) {
          onMouseDown(e, item.id);
        }
        return;
      }
      onMouseDown(e, item.id);
    };
    
    return (
      <div 
        onMouseDown={handleFrozenMouseDown}
        onDoubleClick={(e: React.MouseEvent<HTMLDivElement>) => {
          if (drawingTool) return;
          onDoubleClick(e, item.id);
        }}
        className={finalClassName}
        style={{
          left: item.x,
          top: item.y,
          width: item.width,
          height: item.height,
          zIndex: effectiveZIndex,
          transform: `rotate(${item.rotation || 0}deg)`,
          cursor: drawingTool ? (drawingTool === 'pen' ? whiteBallCursor : 'cell') : undefined,
          ...style,
          // Apply alpha compositing improvements for images
          ...(item.type === ItemType.Image ? alphaCompositeStyle : {})
        }}
      >
          {children}
          {isSelected && !drawingTool && resizeHandles.map(handle => 
              <ResizeHandle key={handle} handle={handle} onMouseDown={(e) => onResizeMouseDown(e, item.id, handle)} />
          )}
          {isSelected && !drawingTool && canRotate && <RotationHandle onMouseDown={(e) => onRotationMouseDown(e, item.id)} />}
          {isGenerating && <LoadingOverlay />}
      </div>
    );
  };

  switch (item.type) {
    case ItemType.StickyNote:
      // StickyNote uses click-through: only the visible note captures clicks
      const stickyZIndex = item.zIndex;
      const stickyClassName = `${itemBaseStyle} ${isSelected ? itemSelectedStyle : ''} ${isEditing ? itemEditingStyle : ''}`;
      
      return (
          <div
              className={stickyClassName}
              style={{
                  left: item.x,
                  top: item.y,
                  width: item.width,
                  height: item.height,
                  zIndex: stickyZIndex,
                  transform: `rotate(${item.rotation || 0}deg)`,
                  pointerEvents: 'none', // Container doesn't capture clicks
              }}
          >
              {/* The visible sticky note - this captures clicks */}
              <div
                  className="w-full h-full rounded-lg relative overflow-hidden"
                  style={{ 
                      backgroundColor: item.backgroundColor, 
                      fontFamily: item.fontFamily,
                      pointerEvents: 'auto',
                      cursor: (isSelected && drawingTool) ? (drawingTool === 'pen' ? whiteBallCursor : 'cell') : 'move',
                  }}
                  onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => {
                      // When drawing tool is active, prevent canvas panning
                      if (drawingTool) {
                          e.stopPropagation();
                          // If not selected, select the item (but don't start drag)
                          if (!isSelected) {
                              onMouseDown(e, item.id);
                          }
                          // If already selected, drawing canvas will handle it
                          return;
                      }
                      onMouseDown(e, item.id);
                  }}
                  onDoubleClick={(e: React.MouseEvent<HTMLDivElement>) => {
                      if (drawingTool) return;
                      onDoubleClick(e, item.id);
                  }}
              >
                  {renderContent()}
                  
                  {/* Drawing overlay */}
                  <DrawingOverlay
                    width={item.width}
                    height={item.height}
                    drawingData={item.drawingData}
                    drawingTool={drawingTool || null}
                    isSelected={isSelected}
                    canvasRef={drawingCanvasRef}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
              </div>
              
              {item.votes > 0 && (
                  <div 
                      className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold z-10"
                      style={{ pointerEvents: 'auto' }}
                  >
                      {item.votes}
                  </div>
              )}
              
              {/* Resize handles - hidden when drawing */}
              {isSelected && !drawingTool && resizeHandles.map(handle => 
                  <ResizeHandle key={handle} handle={handle} onMouseDown={(e) => onResizeMouseDown(e, item.id, handle)} />
              )}
              {isSelected && !drawingTool && canRotate && <RotationHandle onMouseDown={(e) => onRotationMouseDown(e, item.id)} />}
              {isGenerating && <LoadingOverlay />}
          </div>
      );
    case ItemType.Shape:
        // Shape uses click-through: only clicks on the actual shape select it
        const clipPathId = `clip-${item.id}`;
        const shapeZIndex = item.zIndex;
        const shapeClassName = `${itemBaseStyle} ${isSelected ? itemSelectedStyle : ''} ${isEditing ? itemEditingStyle : ''}`;
        
        return (
            <div
                className={shapeClassName}
                style={{
                    left: item.x,
                    top: item.y,
                    width: item.width,
                    height: item.height,
                    zIndex: shapeZIndex,
                    transform: `rotate(${item.rotation || 0}deg)`,
                    pointerEvents: 'none', // Container doesn't capture clicks
                }}
            >
                <svg 
                    width={item.width} 
                    height={item.height} 
                    viewBox={`0 0 ${item.width} ${item.height}`} 
                    className="absolute top-0 left-0" 
                    style={{ overflow: 'visible', pointerEvents: 'none' }}
                >
                    <defs>
                        <clipPath id={clipPathId}>
                            <ShapeElement shape={item.shape!} width={item.width} height={item.height} id={item.id} />
                        </clipPath>
                        <marker
                            id="arrowhead"
                            viewBox="0 0 10 10"
                            refX="5"
                            refY="5"
                            markerWidth="6"
                            markerHeight="6"
                            orient="auto-start-reverse"
                        >
                            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
                        </marker>
                    </defs>
                    
                    {item.generatedVideoUrl ? (
                        <foreignObject x="0" y="0" width={item.width} height={item.height} clipPath={`url(#${clipPathId})`}>
                            <div 
                                className="relative w-full h-full"
                                style={{ pointerEvents: 'auto' }}
                                onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => onMouseDown(e, item.id)}
                                onDoubleClick={(e: React.MouseEvent<HTMLDivElement>) => onDoubleClick(e, item.id)}
                                onMouseEnter={() => setIsHovered(true)}
                                onMouseLeave={() => setIsHovered(false)}
                            >
                                <video 
                                    ref={videoRef}
                                    src={item.generatedVideoUrl}
                                    autoPlay 
                                    loop 
                                    muted 
                                    className="w-full h-full object-cover"
                                    onPlay={() => setIsPaused(false)}
                                    onPause={() => setIsPaused(true)}
                                />
                                {isHovered && !isGenerating && (
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-4 transition-opacity">
                                        <button
                                            onClick={togglePlayPause}
                                            className="text-white p-2 rounded-full bg-black/50 hover:bg-black/80 transition-colors"
                                            title={isPaused ? "Play" : "Pause"}
                                        >
                                            {isPaused ? <PlayIcon /> : <PauseIcon />}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </foreignObject>
                    ) : item.generatedImageUrl ? (
                        <image 
                            href={item.generatedImageUrl} 
                            x="0" 
                            y="0" 
                            width={item.width} 
                            height={item.height} 
                            clipPath={`url(#${clipPathId})`}
                            style={{ pointerEvents: 'painted', cursor: 'move' }}
                            onMouseDown={(e: React.MouseEvent<SVGImageElement>) => onMouseDown(e as any, item.id)}
                            onDoubleClick={(e: React.MouseEvent<SVGImageElement>) => onDoubleClick(e as any, item.id)}
                        />
                    ) : (
                        <ShapeElement 
                            shape={item.shape!} 
                            width={item.width} 
                            height={item.height} 
                            id={item.id} 
                            fill={item.backgroundColor} 
                            stroke={item.backgroundColor} 
                            strokeWidth={8} 
                            color={item.backgroundColor}
                            style={{ pointerEvents: 'painted', cursor: 'move' }}
                            onMouseDown={(e: React.MouseEvent<SVGElement>) => onMouseDown(e as any, item.id)}
                            onDoubleClick={(e: React.MouseEvent<SVGElement>) => onDoubleClick(e as any, item.id)}
                        />
                    )}
                </svg>
                
                {item.votes > 0 && (
                    <div 
                        className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold z-10"
                        style={{ pointerEvents: 'auto' }}
                    >
                        {item.votes}
                    </div>
                )}
                
                {/* Text content - only clickable if there's text */}
                {item.text && (
                    <div 
                        className="relative w-full h-full flex items-center justify-center"
                        style={{ pointerEvents: 'auto' }}
                        onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => onMouseDown(e, item.id)}
                        onDoubleClick={(e: React.MouseEvent<HTMLDivElement>) => onDoubleClick(e, item.id)}
                    >
                        {renderContent()}
                    </div>
                )}
                
                {/* Resize handles - hidden when drawing */}
                {isSelected && !drawingTool && resizeHandles.map(handle => 
                    <ResizeHandle key={handle} handle={handle} onMouseDown={(e) => onResizeMouseDown(e, item.id, handle)} />
                )}
                {isSelected && !drawingTool && canRotate && <RotationHandle onMouseDown={(e) => onRotationMouseDown(e, item.id)} />}
                {isGenerating && <LoadingOverlay />}
            </div>
        );
    case ItemType.TextBox:
        // TextBox uses click-through: only the text content captures clicks
        const textBoxZIndex = item.zIndex;
        const textBoxClassName = `${itemBaseStyle} ${isSelected ? itemSelectedStyle : ''} ${isEditing ? itemEditingStyle : ''} bg-transparent`;
        
        return (
            <div
                className={textBoxClassName}
                style={{
                    left: item.x,
                    top: item.y,
                    width: item.width,
                    height: item.height,
                    zIndex: textBoxZIndex,
                    transform: `rotate(${item.rotation || 0}deg)`,
                    fontFamily: item.fontFamily,
                    pointerEvents: 'none', // Container doesn't capture clicks
                }}
            >
                {/* Text content - captures clicks */}
                <div
                    className="w-full h-full"
                    style={{ 
                        pointerEvents: 'auto',
                        cursor: 'move',
                    }}
                    onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => onMouseDown(e, item.id)}
                    onDoubleClick={(e: React.MouseEvent<HTMLDivElement>) => onDoubleClick(e, item.id)}
                >
                    {renderContent()}
                </div>
                
                {item.votes > 0 && (
                    <div 
                        className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold z-10"
                        style={{ pointerEvents: 'auto' }}
                    >
                        {item.votes}
                    </div>
                )}
                
                {/* Resize handles - hidden when drawing */}
                {isSelected && !drawingTool && resizeHandles.map(handle => 
                    <ResizeHandle key={handle} handle={handle} onMouseDown={(e) => onResizeMouseDown(e, item.id, handle)} />
                )}
                {isSelected && !drawingTool && canRotate && <RotationHandle onMouseDown={(e) => onRotationMouseDown(e, item.id)} />}
                {isGenerating && <LoadingOverlay />}
            </div>
        );
    case ItemType.Frame:
        // Frame needs special handling - interior should pass clicks through to items inside
        const frameZIndex = item.zIndex;
        return (
            <div
                className="absolute select-none"
                style={{
                    left: item.x,
                    top: item.y,
                    width: item.width,
                    height: item.height,
                    zIndex: frameZIndex,
                    pointerEvents: 'none', // Let clicks pass through the interior
                }}
            >
                {/* Visual border only - no pointer events */}
                <div
                    className="absolute inset-0 border-2 border-dashed rounded-lg"
                    style={{ 
                        pointerEvents: 'none',
                        borderColor: item.backgroundColor === 'transparent' ? 'transparent' : (item.backgroundColor || '#6b7280'),
                    }}
                />
                
                {/* Clickable border zones - separate elements for each edge */}
                <div 
                    className="absolute -top-2 -left-2 -right-2 h-4 cursor-move"
                    style={{ pointerEvents: 'auto' }}
                    onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => onMouseDown(e, item.id)}
                    onDoubleClick={(e: React.MouseEvent<HTMLDivElement>) => onDoubleClick(e, item.id)}
                />
                <div 
                    className="absolute -bottom-2 -left-2 -right-2 h-4 cursor-move"
                    style={{ pointerEvents: 'auto' }}
                    onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => onMouseDown(e, item.id)}
                    onDoubleClick={(e: React.MouseEvent<HTMLDivElement>) => onDoubleClick(e, item.id)}
                />
                <div 
                    className="absolute top-2 -left-2 bottom-2 w-4 cursor-move"
                    style={{ pointerEvents: 'auto' }}
                    onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => onMouseDown(e, item.id)}
                    onDoubleClick={(e: React.MouseEvent<HTMLDivElement>) => onDoubleClick(e, item.id)}
                />
                <div 
                    className="absolute top-2 -right-2 bottom-2 w-4 cursor-move"
                    style={{ pointerEvents: 'auto' }}
                    onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => onMouseDown(e, item.id)}
                    onDoubleClick={(e: React.MouseEvent<HTMLDivElement>) => onDoubleClick(e, item.id)}
                />
                
                {/* Frame label */}
                {isEditing ? (
                    <textarea
                        value={item.text || ''}
                        onChange={handleTextChange}
                        className="absolute -top-7 left-0 bg-gray-900 focus:bg-gray-700 w-auto min-w-[100px] px-2 text-sm resize-none focus:outline-none rounded-md"
                        style={{color: item.textColor || '#FFFFFF', fontFamily: item.fontFamily || 'Inter, sans-serif', overflow: 'hidden', height: '24px', pointerEvents: 'auto'}}
                        autoFocus
                        onBlur={(e) => {
                            const boardItem = (e.target as HTMLElement).closest('.board-item');
                            if (boardItem) {
                                (boardItem as HTMLElement).focus();
                            }
                        }}
                    />
                ) : (
                    <div 
                        className="absolute -top-7 left-0 bg-gray-800 px-2 text-sm rounded-md cursor-move" 
                        style={{color: item.textColor || '#FFFFFF', fontFamily: item.fontFamily || 'Inter, sans-serif', pointerEvents: 'auto'}}
                        onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => onMouseDown(e, item.id)}
                        onDoubleClick={(e: React.MouseEvent<HTMLDivElement>) => onDoubleClick(e, item.id)}
                    >
                        {item.text || 'Frame'}
                    </div>
                )}
                
                {item.votes > 0 && <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold z-10" style={{ pointerEvents: 'auto' }}>{item.votes}</div>}
                
                {/* Resize handles - hidden when drawing */}
                {isSelected && !drawingTool && resizeHandles.map(handle => 
                    <ResizeHandle key={handle} handle={handle} onMouseDown={(e) => onResizeMouseDown(e, item.id, handle)} />
                )}
            </div>
        );
    case ItemType.Image:
      // Image uses click-through: only the image itself captures clicks
      const { crop, originalWidth, originalHeight } = item;
      const imageZIndex = item.zIndex;
      const imageClassName = `${itemBaseStyle} ${isSelected ? itemSelectedStyle : ''} ${isEditing ? itemEditingStyle : ''} bg-transparent`;
      const imageStyle: React.CSSProperties = {};
      
      if (crop && originalWidth && originalHeight) {
        const scaleX = item.width / crop.width;
        const scaleY = item.height / crop.height;
        
        imageStyle.width = originalWidth * scaleX;
        imageStyle.height = originalHeight * scaleY;
        imageStyle.transform = `translate(-${crop.x * scaleX}px, -${crop.y * scaleY}px)`;
        imageStyle.position = 'absolute';
      } else {
        imageStyle.width = '100%';
        imageStyle.height = '100%';
        imageStyle.objectFit = 'contain'; // Changed from 'cover' to show full image content
      }

      return (
          <div
              className={imageClassName}
              style={{
                  left: item.x,
                  top: item.y,
                  width: item.width,
                  height: item.height,
                  zIndex: imageZIndex,
                  transform: `rotate(${item.rotation || 0}deg)`,
                  pointerEvents: 'none', // Container doesn't capture clicks
                  ...alphaCompositeStyle,
              }}
          >
              {/* Image content - captures clicks */}
              <div 
                  className="w-full h-full overflow-hidden rounded-lg" 
                  style={{
                      isolation: 'isolate',
                      transform: 'translateZ(0)',
                      position: 'relative',
                      backgroundColor: 'transparent',
                      pointerEvents: 'auto',
                      cursor: (isSelected && drawingTool) ? (drawingTool === 'pen' ? whiteBallCursor : 'cell') : 'move',
                  }}
                  onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => {
                      // When drawing tool is active, prevent canvas panning
                      if (drawingTool) {
                          e.stopPropagation();
                          // If not selected, select the item (but don't start drag)
                          if (!isSelected) {
                              onMouseDown(e, item.id);
                          }
                          // If already selected, drawing canvas will handle it
                          return;
                      }
                      onMouseDown(e, item.id);
                  }}
                  onDoubleClick={(e: React.MouseEvent<HTMLDivElement>) => {
                      if (drawingTool) return;
                      onDoubleClick(e, item.id);
                  }}
              >
                  <img 
                      key={item.src?.substring(0, 50) || item.id}
                      src={item.src} 
                      alt={item.text} 
                      style={{
                          ...imageStyle,
                          imageRendering: 'crisp-edges',
                          backfaceVisibility: 'hidden',
                          WebkitBackfaceVisibility: 'hidden',
                          mixBlendMode: 'normal',
                          msInterpolationMode: 'nearest-neighbor' as any,
                          WebkitImageSmoothing: false as any,
                      }}
                      draggable="false"
                      onContextMenu={(e) => e.preventDefault()}
                      loading="eager"
                  />
                  
                  {/* Drawing overlay */}
                  <DrawingOverlay
                    width={item.width}
                    height={item.height}
                    drawingData={item.drawingData}
                    drawingTool={drawingTool || null}
                    isSelected={isSelected}
                    canvasRef={drawingCanvasRef}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
              </div>
              
              {/* Resize handles - hidden when drawing */}
              {isSelected && !drawingTool && resizeHandles.map(handle => 
                  <ResizeHandle key={handle} handle={handle} onMouseDown={(e) => onResizeMouseDown(e, item.id, handle)} />
              )}
              {isSelected && !drawingTool && canRotate && <RotationHandle onMouseDown={(e) => onRotationMouseDown(e, item.id)} />}
              {isGenerating && <LoadingOverlay />}
          </div>
      );
    case ItemType.YouTubeVideo:
        // YouTube uses click-through: only the video area captures clicks
        const youtubeZIndex = item.zIndex;
        const youtubeClassName = `${itemBaseStyle} ${isSelected ? itemSelectedStyle : ''} ${isEditing ? itemEditingStyle : ''}`;
        
        return (
            <div
                className={youtubeClassName}
                style={{
                    left: item.x,
                    top: item.y,
                    width: item.width,
                    height: item.height,
                    zIndex: youtubeZIndex,
                    transform: `rotate(${item.rotation || 0}deg)`,
                    pointerEvents: 'none', // Container doesn't capture clicks
                }}
            >
                <div className="w-full h-full relative overflow-hidden rounded-lg">
                    <iframe
                        width="100%"
                        height="100%"
                        src={`https://www.youtube.com/embed/${item.videoId}?autoplay=0&controls=1&modestbranding=1&rel=0`}
                        title="YouTube video player"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                        allowFullScreen
                        className="absolute inset-0"
                        style={{ pointerEvents: isInteractive ? 'auto' : 'none' }}
                    ></iframe>
                    
                    {/* Always show overlay when not interactive */}
                    {!isInteractive && (
                        <div 
                            className="absolute inset-0 cursor-move flex items-center justify-center bg-black/5 hover:bg-black/20 transition-colors duration-200 group"
                            style={{ pointerEvents: 'auto' }}
                            onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => onMouseDown(e, item.id)}
                            onDoubleClick={(e) => onDoubleClick(e, item.id)}
                        >
                           <div className="text-white text-sm bg-black/70 px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                               Double-click to play video
                           </div>
                        </div>
                    )}
                    
                    {/* Show hint when interactive */}
                    {isInteractive && isSelected && (
                        <div className="absolute top-2 right-2 text-xs text-white bg-black/70 px-2 py-1 rounded pointer-events-none">
                            Press ESC to move video
                        </div>
                    )}
                </div>
                
                {/* Resize handles - hidden when drawing */}
                {isSelected && !drawingTool && resizeHandles.map(handle => 
                    <ResizeHandle key={handle} handle={handle} onMouseDown={(e) => onResizeMouseDown(e, item.id, handle)} />
                )}
                {isSelected && !drawingTool && canRotate && <RotationHandle onMouseDown={(e) => onRotationMouseDown(e, item.id)} />}
                {isGenerating && <LoadingOverlay />}
            </div>
        );
    case ItemType.NoteCard:
        return renderWrapper(
            <NoteCard item={item} scale={panZoom.k} />,
            'overflow-visible',
            { cursor: 'move' }
        );
    case ItemType.ObsidianNote:
        // ObsidianNote uses click-through
        const obsidianZIndex = item.zIndex;
        const obsidianClassName = `${itemBaseStyle} ${isSelected ? itemSelectedStyle : ''} ${isEditing ? itemEditingStyle : ''}`;
        
        return (
            <div
                className={obsidianClassName}
                style={{
                    left: item.x,
                    top: item.y,
                    width: item.width,
                    height: item.height,
                    zIndex: obsidianZIndex,
                    transform: `rotate(${item.rotation || 0}deg)`,
                    pointerEvents: 'none', // Container doesn't capture clicks
                }}
            >
                <div style={{ pointerEvents: 'auto' }}>
                    <ObsidianNoteComponent
                        item={item}
                        panZoom={panZoom}
                        isSelected={isSelected}
                        isEditing={isEditing}
                        onDoubleClick={(e) => onDoubleClick(e, item.id)}
                        onMouseDown={onMouseDown}
                        onTextChange={onTextChange}
                    />
                </div>
                
                {/* Resize handles - hidden when drawing */}
                {isSelected && !drawingTool && resizeHandles.map(handle => 
                    <ResizeHandle key={handle} handle={handle} onMouseDown={(e) => onResizeMouseDown(e, item.id, handle)} />
                )}
                {isSelected && !drawingTool && canRotate && <RotationHandle onMouseDown={(e) => onRotationMouseDown(e, item.id)} />}
                {isGenerating && <LoadingOverlay />}
            </div>
        );
    default:
      return null;
  }
};