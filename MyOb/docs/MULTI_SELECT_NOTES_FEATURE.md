# Multi-Select Notes Feature

## Overview
Added robust multi-select functionality to the FileBrowser component, allowing users to select multiple notes using Shift+Click and move them in bulk to folders via drag-and-drop.

## Features Implemented

### 1. **Single Note Selection**
- **Click** on a note to select/deselect it
- Selected notes show a **checkmark icon** and highlighted background
- Click again to deselect

### 2. **Range Selection with Shift+Click**
- **Click** first note to select it
- **Hold Shift + Click** second note to select all notes between them
- Works across different levels of folder hierarchy
- Automatically calculates the range based on visual order

### 3. **Visual Indicators**
- **CheckSquare icon**: Shows on selected notes
- **Primary background**: Selected notes have `bg-primary/10` with border
- **Selection count**: Bottom panel shows number of selected notes
- **Clear button**: Quick way to deselect all notes

### 4. **Bulk Drag & Drop**
- **Drag any selected note** to drag all selected notes
- **Drop on folder** to move all selected notes at once
- **Visual feedback**: Folder shows dashed border on drag-over
- **Automatic batch processing**: All moves execute in sequence

### 5. **Selection Panel**
Located at the bottom of the FileBrowser:
```
┌─────────────────────────────────────┐
│ 5 notes selected           [Clear]  │
│ Drag to folder or Shift+Click more │
└─────────────────────────────────────┘
```

## User Workflow

### Selecting Multiple Notes:

**Method 1: Individual Selection**
1. Click note A → Selected
2. Click note B → Both selected
3. Click note C → All three selected

**Method 2: Range Selection (Recommended for many notes)**
1. Click first note
2. Hold Shift
3. Click last note
4. All notes in between are selected

### Moving Selected Notes:

1. Select multiple notes (using either method above)
2. Click and drag any selected note
3. Hover over target folder (shows dashed border)
4. Release mouse to drop
5. All selected notes move to that folder

### Clearing Selection:

- Click **Clear** button in selection panel
- Click on empty space in the file browser (outside notes)
- Or click individual notes to deselect them

## Technical Implementation

### State Management:
```typescript
const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
const [lastClickedFile, setLastClickedFile] = useState<string | null>(null);
```

### Selection Logic:
- **Regular Click**: Toggles individual note selection
- **Shift+Click**: Selects range from last clicked to current
- Uses flat file list to determine range order

### Drag & Drop Enhancement:
- Selected files stored as JSON array in dataTransfer
- Drop handler processes array and moves all files
- Fallback to single file for backwards compatibility

## Code Changes

### Files Modified:
- `FileBrowser.tsx` - Main component with multi-select logic

### New Props:
```typescript
selectedFiles: Set<string>
onFileClick: (id: string, isShiftClick: boolean) => void
```

### New Icons:
- `CheckSquare` - Shows on selected notes
- `Square` - (Available for future use)

### Styling Classes:
```css
${isSelected && !isFolder ? 'bg-primary/10 border border-primary/30' : ''}
```

## Edge Cases Handled

1. **Dragging unselected note**: Only that note is dragged
2. **Dragging selected note**: All selected notes are dragged
3. **Shift-click with no previous selection**: Just selects that note
4. **Clicking folder**: Doesn't trigger selection (folders expand/collapse)
5. **Clicking empty space**: Clears all selections
6. **Search filtering**: Selection persists across filter changes
7. **Range across folders**: Correctly calculates order including nested files

## Future Enhancements

### Potential Additions:
- [ ] Ctrl+Click for non-contiguous selection (Windows/Linux)
- [ ] Cmd+Click for non-contiguous selection (Mac)
- [ ] Select All (Ctrl+A) functionality
- [ ] Bulk delete for selected notes
- [ ] Bulk tag editing
- [ ] Copy/paste notes between folders
- [ ] Keyboard navigation with arrow keys
- [ ] Context menu for selected notes (right-click)

## Performance Considerations

- Uses `Set<string>` for O(1) selection lookups
- Flat file list cached only when needed for range calculation
- No re-renders when dragging (only on drop)
- Efficient traversal for nested folder structures

## User Feedback

### Visual Cues:
✅ Checkmark icon on selected notes
✅ Highlight background for selection
✅ Count of selected notes
✅ Clear instructions in selection panel
✅ Dashed border on drop target

### Animations:
- Smooth transitions for selection highlighting
- Hover effects maintained
- Shadow effects for depth

## Testing Checklist

- [ ] Select single note
- [ ] Deselect single note
- [ ] Select multiple notes individually
- [ ] Shift+click range selection (2 notes)
- [ ] Shift+click range selection (10+ notes)
- [ ] Shift+click across folders
- [ ] Drag single selected note
- [ ] Drag multiple selected notes
- [ ] Drop on different folders
- [ ] Clear selection button
- [ ] Selection persists during search
- [ ] Cannot select folders
- [ ] Clicking active note doesn't open it when selecting

## Date Implemented
2025-10-08

---

**Result**: Users can now efficiently organize large numbers of notes by selecting multiple notes with Shift+Click and moving them all at once to target folders via drag-and-drop.
