# Pen Tool + AI Image Edit Integration Plan

## Overview

Enhance Mero's image editing workflow by integrating the pen tool markup with AI image editing (Nano Banana). Users can draw on images to indicate areas they want modified, then use natural language prompts to describe the changes.

## Current State (Completed)

### Pen Tool Implementation ✅
- `DrawingTool` type added (`'pen' | 'eraser' | null`)
- `drawingData` field added to `BoardItem` (stores base64 PNG overlay)
- Pen and Eraser buttons in toolbar
- `DrawingOverlay` component for per-item drawing canvas
- Drawing works on StickyNote and Image item types
- Red pen strokes (#ef4444), eraser removes strokes
- Drawings persist with item data

### Existing AI Image Edit ✅
- `AiImageEditModal` component
- Nano Banana API integration via `generateImageEdit()`
- Right-click context menu "Edit with AI"
- Edit history tracking per item

---

## Proposed Enhancement

### User Flow

```
1. User has an image on canvas (any source: uploaded, AI-generated, dragged in)
2. User selects Pen tool from toolbar
3. User clicks image to select it
4. User draws red markup indicating area to modify (e.g., circles someone's face)
5. User right-clicks → "Edit with AI" (or uses contextual toolbar button)
6. Modal opens showing:
   - Preview of image WITH markup composited (what AI will see)
   - Text input for prompt
   - "Apply Edit" button
7. User types: "give him sunglasses"
8. System composites image + drawing → sends to Nano Banana with prompt
9. AI returns modified image
10. Result replaces original image, drawing layer is cleared
11. Edit added to history for potential revert
```

### Technical Implementation

#### 1. Composite Function
Create a utility to merge image + drawing overlay:

```typescript
// utils/compositeImage.ts
export async function compositeImageWithDrawing(
  imageSrc: string,      // Original image (base64 or URL)
  drawingData: string,   // Drawing overlay (base64 PNG)
  width: number,
  height: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return reject('Canvas not supported');

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Set canvas to image dimensions
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Draw original image
      ctx.drawImage(img, 0, 0);
      
      // Draw markup overlay (scaled to match)
      const overlay = new Image();
      overlay.onload = () => {
        ctx.drawImage(overlay, 0, 0, img.width, img.height);
        resolve(canvas.toDataURL('image/png'));
      };
      overlay.onerror = () => reject('Failed to load drawing overlay');
      overlay.src = drawingData;
    };
    img.onerror = () => reject('Failed to load image');
    img.src = imageSrc;
  });
}
```

#### 2. Enhance AiImageEditModal

Modify to detect and use `drawingData`:

```typescript
interface AiImageEditModalProps {
  item: BoardItem;
  // ... existing props
}

// In the modal:
const hasMarkup = !!item.drawingData;
const [compositedPreview, setCompositedPreview] = useState<string | null>(null);

useEffect(() => {
  if (hasMarkup && item.src && item.drawingData) {
    compositeImageWithDrawing(item.src, item.drawingData, item.width, item.height)
      .then(setCompositedPreview)
      .catch(console.error);
  }
}, [item]);

// Show markup indicator in UI
{hasMarkup && (
  <div className="text-sm text-blue-400 mb-2">
    ✏️ Markup detected - AI will edit the marked areas
  </div>
)}

// Preview shows composited image if markup exists
<img src={hasMarkup ? compositedPreview : item.src} />
```

#### 3. Modify API Call

When sending to Nano Banana, use composited image if markup exists:

```typescript
const handleApplyEdit = async () => {
  const imageToSend = hasMarkup && compositedPreview 
    ? compositedPreview 
    : item.src;
  
  const result = await generateImageEdit(
    imageToSend,
    prompt,
    referenceImage,
    resolution,
    removeBackground
  );
  
  // Clear drawing after successful edit
  onApply(item.id, result, prompt, item.src);
  onClearDrawing?.(item.id); // New callback to clear drawingData
};
```

#### 4. Clear Drawing After Edit

Add callback to clear `drawingData` after successful AI edit:

```typescript
// In App.tsx
const handleClearItemDrawing = (itemId: string) => {
  updateItem(itemId, { drawingData: undefined });
};

// Pass to modal
<AiImageEditModal
  onClearDrawing={handleClearItemDrawing}
  // ...
/>
```

#### 5. Visual Indicator

Show indicator when image has markup:
- Small pen icon badge on image corner
- Different border color when markup present
- Tooltip: "This image has markup - Edit with AI to apply changes"

---

## UI/UX Considerations

### Markup Workflow Tips
- Tooltip on pen tool: "Draw on images to mark areas for AI editing"
- When user draws on image, show subtle hint: "Right-click → Edit with AI to apply changes"

### Preview in Modal
- Side-by-side: Original | With Markup
- Or toggle switch to compare
- Clear indication of what AI will receive

### Error Handling
- If composite fails, fall back to original image
- Warn user if markup might be lost
- Confirm before clearing large markup

---

## Files to Modify

1. **utils/compositeImage.ts** (NEW)
   - Composite function

2. **components/AiImageEditModal.tsx**
   - Detect drawingData
   - Show composited preview
   - Use composited image for API call
   - Add clear drawing callback

3. **App.tsx**
   - Add handleClearItemDrawing function
   - Pass to AiImageEditModal

4. **components/BoardItemComponent.tsx**
   - Optional: Visual indicator for images with markup

5. **components/ContextMenu.tsx**
   - Optional: Change "Edit with AI" text to "Apply Markup Edit" when markup exists

---

## Future Enhancements

1. **Quick Inline Edit**
   - After drawing, show mini prompt input on canvas
   - Skip modal for faster workflow

2. **Mask Generation**
   - Convert pen strokes to proper mask
   - Send as separate mask parameter for inpainting models

3. **Brush Size Control**
   - Add brush size slider in toolbar
   - Thicker/thinner strokes for different use cases

4. **Color Options**
   - Different colors for different edit types
   - Or keep red as standard "edit this" indicator

5. **Undo/Redo for Drawings**
   - Expose undo functionality in toolbar
   - Keyboard shortcut (Ctrl+Z when drawing)

---

## Testing Checklist

- [ ] Draw on image, open AI edit modal - see composited preview
- [ ] Submit edit with markup - AI receives marked image
- [ ] After successful edit - drawing cleared
- [ ] Edit history works correctly
- [ ] Uploaded images work (not just AI-generated)
- [ ] Large images composite correctly
- [ ] Eraser removes markup before edit
- [ ] Cancel edit - markup preserved

---

## Timeline Estimate

- Composite utility: 30 min
- Modal enhancement: 1-2 hours  
- Integration & testing: 1 hour
- Polish & edge cases: 1 hour

**Total: ~4 hours**
