/**
 * CodeMirror extension for rendering inline image previews
 * Shows actual images for markdown image syntax: ![alt](url)
 */

import { ViewPlugin, Decoration, DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import { Range } from "@codemirror/state";

class ImageWidget extends WidgetType {
  constructor(
    readonly src: string, 
    readonly alt: string, 
    readonly initialWidth: number = 400,
    readonly markdownPos: { from: number; to: number } | null = null,
    readonly view: EditorView | null = null
  ) {
    super();
  }

  eq(other: ImageWidget) {
    return other.src === this.src && other.alt === this.alt;
  }

  toDOM() {
    const container = document.createElement("div");
    container.className = "cm-image-preview";
    container.tabIndex = 0; // Make it focusable for keyboard events
    container.style.cssText = `
      display: inline-block;
      margin: 8px 0;
      max-width: 100%;
      position: relative;
      width: ${this.initialWidth}px;
      border-radius: 8px;
      border: 2px solid transparent;
      transition: border-color 0.2s;
      outline: none;
    `;

    const img = document.createElement("img");
    img.src = this.src;
    img.alt = this.alt;
    img.style.cssText = `
      width: 100%;
      height: auto;
      display: block;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      cursor: pointer;
      transition: box-shadow 0.2s;
      pointer-events: auto;
    `;
    
    // Create resize handles for all 4 corners and 4 edges
    const handleStyle = (cursor: string, position: string) => `
      position: absolute;
      ${position}
      width: 12px;
      height: 12px;
      background: rgba(59, 130, 246, 0.8);
      border: 2px solid white;
      border-radius: 50%;
      cursor: ${cursor};
      opacity: 0;
      transition: opacity 0.2s;
      z-index: 10;
    `;
    
    // Corner handles
    const topLeft = document.createElement('div');
    topLeft.style.cssText = handleStyle('nwse-resize', 'top: -6px; left: -6px;') + 'pointer-events: auto;';
    topLeft.dataset.handle = 'tl';
    
    const topRight = document.createElement('div');
    topRight.style.cssText = handleStyle('nesw-resize', 'top: -6px; right: -6px;') + 'pointer-events: auto;';
    topRight.dataset.handle = 'tr';
    
    const bottomLeft = document.createElement('div');
    bottomLeft.style.cssText = handleStyle('nesw-resize', 'bottom: -6px; left: -6px;') + 'pointer-events: auto;';
    bottomLeft.dataset.handle = 'bl';
    
    const bottomRight = document.createElement('div');
    bottomRight.style.cssText = handleStyle('nwse-resize', 'bottom: -6px; right: -6px;') + 'pointer-events: auto;';
    bottomRight.dataset.handle = 'br';
    
    // Edge handles  
    const edgeHandleStyle = (cursor: string, position: string, size: string) => `
      position: absolute;
      ${position}
      ${size}
      background: rgba(59, 130, 246, 0.6);
      border: 1px solid white;
      border-radius: 2px;
      cursor: ${cursor};
      opacity: 0;
      transition: opacity 0.2s;
      z-index: 10;
    `;
    
    const topEdge = document.createElement('div');
    topEdge.style.cssText = edgeHandleStyle('ns-resize', 'top: -4px; left: 50%; transform: translateX(-50%);', 'width: 40px; height: 8px;') + 'pointer-events: auto;';
    topEdge.dataset.handle = 't';
    
    const rightEdge = document.createElement('div');
    rightEdge.style.cssText = edgeHandleStyle('ew-resize', 'right: -4px; top: 50%; transform: translateY(-50%);', 'width: 8px; height: 40px;') + 'pointer-events: auto;';
    rightEdge.dataset.handle = 'r';
    
    const bottomEdge = document.createElement('div');
    bottomEdge.style.cssText = edgeHandleStyle('ns-resize', 'bottom: -4px; left: 50%; transform: translateX(-50%);', 'width: 40px; height: 8px;') + 'pointer-events: auto;';
    bottomEdge.dataset.handle = 'b';
    
    const leftEdge = document.createElement('div');
    leftEdge.style.cssText = edgeHandleStyle('ew-resize', 'left: -4px; top: 50%; transform: translateY(-50%);', 'width: 8px; height: 40px;') + 'pointer-events: auto;';
    leftEdge.dataset.handle = 'l';
    
    // Delete button (trash icon)
    const deleteButton = document.createElement('button');
    deleteButton.innerHTML = '🗑️';
    deleteButton.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      width: 32px;
      height: 32px;
      background: rgba(239, 68, 68, 0.9);
      color: white;
      border: 2px solid white;
      border-radius: 50%;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s, transform 0.1s;
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      pointer-events: auto;
    `;
    deleteButton.title = 'Delete image (or press Delete key)';
    
    // Show/hide resize handles and delete button on hover
    container.addEventListener('mouseenter', () => {
      container.style.borderColor = 'rgba(59, 130, 246, 0.5)';
      img.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.2)';
      // Show all handles and delete button
      [topLeft, topRight, bottomLeft, bottomRight, topEdge, rightEdge, bottomEdge, leftEdge, deleteButton].forEach(handle => {
        (handle as HTMLElement).style.opacity = '1';
      });
    });
    container.addEventListener('mouseleave', () => {
      container.style.borderColor = 'transparent';
      img.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
      // Hide all handles and delete button
      [topLeft, topRight, bottomLeft, bottomRight, topEdge, rightEdge, bottomEdge, leftEdge, deleteButton].forEach(handle => {
        (handle as HTMLElement).style.opacity = '0';
      });
    });
    
    // Delete functionality
    const deleteImage = () => {
      if (this.markdownPos && this.view) {
        console.log('[ImageWidget] Deleting image from editor');
        
        // Delete the markdown image syntax from the document
        this.view.dispatch({
          changes: {
            from: this.markdownPos.from,
            to: this.markdownPos.to,
            insert: '' // Replace with empty string (delete)
          }
        });
      }
    };
    
    // Delete button click
    deleteButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      deleteImage();
    });
    
    deleteButton.addEventListener('mouseenter', () => {
      deleteButton.style.transform = 'scale(1.1)';
    });
    
    deleteButton.addEventListener('mouseleave', () => {
      deleteButton.style.transform = 'scale(1)';
    });
    
    // Keyboard delete support
    container.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        e.stopPropagation();
        deleteImage();
      }
    });
    
    // Focus on click to enable keyboard delete
    container.addEventListener('click', (e) => {
      // Only focus if not clicking on handles or delete button
      const target = e.target as HTMLElement;
      if (target === container || target === img) {
        container.focus();
      }
    });
    
    // Track if we're currently resizing to prevent modal from opening
    let isDragging = false;
    let hasMoved = false;
    
    // Drag resize functionality
    const handles = [topLeft, topRight, bottomLeft, bottomRight, topEdge, rightEdge, bottomEdge, leftEdge];
    handles.forEach(handle => {
      // Prevent clicks on handles from reaching the image
      handle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      });
      
      handle.addEventListener('mousedown', (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        isDragging = true;
        hasMoved = false;
        
        const mouseEvent = e as MouseEvent;
        const startX = mouseEvent.clientX;
        const startY = mouseEvent.clientY;
        const startWidth = container.offsetWidth;
        const startHeight = container.offsetHeight;
        const handleType = (handle as HTMLElement).dataset.handle;
        
        const onMouseMove = (moveEvent: MouseEvent) => {
          moveEvent.preventDefault();
          moveEvent.stopPropagation();
          
          hasMoved = true; // Mark that we've actually moved
          
          const dx = moveEvent.clientX - startX;
          const dy = moveEvent.clientY - startY;
          
          let newWidth = startWidth;
          let newHeight = startHeight;
          
          // Calculate new dimensions based on which handle is dragged
          switch(handleType) {
            case 'br': // bottom-right
              newWidth = startWidth + dx;
              break;
            case 'bl': // bottom-left  
              newWidth = startWidth - dx;
              break;
            case 'tr': // top-right
              newWidth = startWidth + dx;
              break;
            case 'tl': // top-left
              newWidth = startWidth - dx;
              break;
            case 'r': // right edge
              newWidth = startWidth + dx;
              break;
            case 'l': // left edge
              newWidth = startWidth - dx;
              break;
            case 't': // top edge
            case 'b': // bottom edge
              // For top/bottom, adjust width proportionally
              newWidth = startWidth + dx;
              break;
          }
          
          // Enforce minimum and maximum widths
          newWidth = Math.max(100, Math.min(newWidth, 1200));
          
          container.style.width = `${newWidth}px`;
        };
        
        const onMouseUp = (upEvent: MouseEvent) => {
          upEvent.preventDefault();
          upEvent.stopPropagation();
          
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          
          isDragging = false;
          
          // Only update markdown if we actually moved
          if (hasMoved && this.markdownPos && this.view) {
            const currentWidth = Math.round(container.offsetWidth);
            const doc = this.view.state.doc;
            const markdownText = doc.sliceString(this.markdownPos.from, this.markdownPos.to);
            
            // Extract alt and src from current markdown
            const match = markdownText.match(/!\[([^\]]*)\]\(([^)]+)\)/);
            if (match) {
              const alt = match[1];
              const src = match[2];
              
              // Remove any existing width specification
              const cleanAlt = alt.replace(/\|\d+$/, '');
              
              // Create new markdown with width only (height maintains aspect ratio)
              const newMarkdown = `![${cleanAlt}|${currentWidth}](${src})`;
              
              // Update the document
              this.view.dispatch({
                changes: {
                  from: this.markdownPos.from,
                  to: this.markdownPos.to,
                  insert: newMarkdown
                }
              });
              
              console.log(`[ImageResize] Updated width to ${currentWidth}px (height auto-maintains aspect ratio)`);
            }
            
            // Reset hasMoved after a delay to prevent modal from opening immediately
            setTimeout(() => {
              hasMoved = false;
              console.log('[ImageResize] Reset hasMoved flag');
            }, 300);
          } else {
            // If we didn't move, reset immediately
            hasMoved = false;
          }
        };
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
    });
    
    // Click to view full size (only on the image, not resize handle)
    img.addEventListener('click', (e) => {
      // Don't open modal if we're currently dragging a handle
      if (isDragging || hasMoved) {
        console.log('[ImageWidget] Click blocked - was dragging or just moved');
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      
      e.stopPropagation();
      console.log('[ImageWidget] Opening full-size modal');
      
      // Remove any existing modals first (cleanup)
      const existingModals = document.querySelectorAll('.cm-image-modal');
      existingModals.forEach(m => m.remove());
      
      const modal = document.createElement('div');
      modal.className = 'cm-image-modal';
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        cursor: pointer;
      `;
      
      const fullImg = document.createElement('img');
      fullImg.src = this.src;
      fullImg.style.cssText = `
        max-width: 90%;
        max-height: 90%;
        object-fit: contain;
      `;
      
      modal.appendChild(fullImg);
      modal.addEventListener('click', () => {
        console.log('[ImageWidget] Closing modal');
        modal.remove();
      });
      document.body.appendChild(modal);
    });

    // Error handling
    img.addEventListener('error', () => {
      container.innerHTML = `
        <span style="
          color: #ef4444;
          font-size: 12px;
          padding: 4px 8px;
          background: #fee;
          border-radius: 4px;
          display: inline-block;
        ">⚠️ Failed to load image</span>
      `;
    });

    container.appendChild(img);
    // Append all resize handles
    container.appendChild(topLeft);
    container.appendChild(topRight);
    container.appendChild(bottomLeft);
    container.appendChild(bottomRight);
    container.appendChild(topEdge);
    container.appendChild(rightEdge);
    container.appendChild(bottomEdge);
    container.appendChild(leftEdge);
    // Append delete button
    container.appendChild(deleteButton);
    return container;
  }

  ignoreEvent(event: Event) {
    // Ignore mouse events so CodeMirror doesn't place cursor in base64 text
    // This prevents clicking on image from showing raw base64 data
    if (event.type === 'mousedown' || event.type === 'click' || event.type === 'mouseup') {
      return true;
    }
    return false;
  }
}

function findImages(view: EditorView) {
  const widgets: Range<Decoration>[] = [];
  const doc = view.state.doc;
  
  // Regex to match markdown images: ![alt](url) or ![alt|width](url)
  // Support both regular URLs and data URLs (base64)
  const imageRegex = /!\[([^\]]*)\]\(((?:data:image\/[^)]+|https?:\/\/[^)]+))\)/g;
  
  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const text = line.text;
    let match;
    
    while ((match = imageRegex.exec(text)) !== null) {
      const altText = match[1] || 'Image';
      const src = match[2];
      const from = line.from + match.index;
      const to = from + match[0].length;
      
      // Only show preview for data: URLs (base64 images)
      if (src.startsWith('data:image/')) {
        // Extract width if present in alt text (format: alt|width)
        // Height auto-maintains aspect ratio
        let alt = altText;
        let width = 400; // default width
        
        const widthMatch = altText.match(/^(.*)\|(\d+)$/);
        if (widthMatch) {
          alt = widthMatch[1];
          width = parseInt(widthMatch[2], 10);
        }
        
        // HIDE the markdown syntax by replacing it with the image
        // Height is auto-calculated to maintain aspect ratio
        const replaceDeco = Decoration.replace({
          widget: new ImageWidget(src, alt, width, { from, to }, view),
        });
        
        widgets.push(replaceDeco.range(from, to));
      }
    }
  }
  
  return Decoration.set(widgets);
}

export const imagePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = findImages(view);
    }

    update(update: any) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = findImages(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);
