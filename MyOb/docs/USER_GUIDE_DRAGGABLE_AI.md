# User Guide: Draggable AI Assistant

## Overview
The AI Assistant is now a draggable modal that you can freely position anywhere on your screen.

---

## Opening the AI Assistant

**Method 1: Toolbar Button**
- Click the **"AI Assist"** button (with sparkles ✨ icon) in the top toolbar
- The modal will appear at your last saved position

**Method 2: (Future) Keyboard Shortcut**
- Currently no keyboard shortcut assigned
- Suggestion: Ctrl+Shift+A

---

## Moving the Modal

1. **Click and hold** on the header area (the top section with "AI Assistant" title)
2. **Drag** the modal to your desired position
3. **Release** the mouse button
4. The position is **automatically saved** and will persist next time you open it

**Visual Feedback:**
- Cursor changes to a **grab hand** (✋) when hovering over the draggable area
- Cursor changes to a **grabbing hand** (✊) while dragging
- The header background is slightly highlighted to indicate it's draggable

**Boundaries:**
- The modal cannot be dragged off-screen
- It will stay within viewport boundaries automatically

---

## Closing the AI Assistant

You have **4 ways** to close the modal:

### 1. ESC Key ⌨️
- Press **ESC** on your keyboard
- Fastest method for power users

### 2. X Button ✖️
- Click the **X** button in the top-right corner of the header
- Located next to the Save button

### 3. Backdrop Click 🖱️
- Click anywhere on the **dark background** outside the modal
- Quick way to dismiss without reaching for buttons

### 4. Toolbar Button Toggle 🔄
- Click the **"AI Assist"** toolbar button again
- Toggles the modal open and closed

---

## Using the AI Assistant

### Chat Features
- **Ask questions** about your notes
- **Get AI-generated answers** with citations
- **Click citations** to navigate directly to referenced notes
- **Toggle Vault Context** to search your notes or ask general questions

### Button Actions

**Settings ⚙️**
- Configure AI settings
- Adjust model parameters
- Manage API keys

**Clear 🗑️**
- Clear conversation history
- Start fresh conversation
- Cannot be undone

**Save 💾**
- Save conversation to your vault
- Creates a new note with chat history
- Preserves citations and formatting

**Close ✖️**
- Close the AI Assistant modal
- Same as pressing ESC or clicking backdrop

---

## Tips & Tricks

### Positioning
- Position the modal **beside your notes** for side-by-side reference
- Place it in a **corner** to keep it out of the way
- Your **position is remembered** between sessions

### Workflow Suggestions
1. **Research**: Keep modal on right, notes on left
2. **Writing**: Position modal at top for quick reference
3. **Editing**: Move modal to bottom while working above

### Best Practices
- Use **Vault Context Mode** for note-specific questions
- Switch to **General Mode** for broader queries
- **Drag anytime** - even during active chat
- Modal stays in place while you work

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Close Modal | **ESC** |
| Send Message | **Enter** |
| New Line | **Shift + Enter** |
| Open Settings | _(none yet)_ |
| Clear Chat | _(none yet)_ |

---

## Troubleshooting

### Modal appears off-screen
- Close and reopen the modal
- It will reset to default position (100, 100)
- Or clear localStorage: `localStorage.removeItem('ai-modal-position')`

### Can't drag the modal
- Make sure you're clicking on the **header area** (not buttons)
- Avoid dragging from buttons (Settings, Clear, Save, Close)
- Try clicking the empty space in the header

### Modal is too small/large
- Current size is fixed at 500px × 600px
- Future update will allow resizing
- Adjust browser zoom if needed

### Position not saving
- Check browser's localStorage is enabled
- Try a different browser
- Clear cache and try again

---

## Technical Details

### Persistence
- Position stored in `localStorage`
- Key: `ai-modal-position`
- Format: `{ x: number, y: number }`

### Default Position
- Initial position: 100px from top, 100px from left
- Automatically adjusts if screen is too small

### Browser Support
- Chrome ✅
- Firefox ✅
- Edge ✅
- Safari ✅
- Opera ✅

---

## Future Enhancements

Planned features for future versions:

- [ ] **Resize handles** - Drag corners to resize modal
- [ ] **Minimize button** - Collapse to small icon
- [ ] **Snap to edges** - Quick positioning to screen edges
- [ ] **Keyboard shortcuts** - Open, close, move with keyboard
- [ ] **Multiple positions** - Save presets (left, right, center)
- [ ] **Touch support** - Drag on tablets and touch screens
- [ ] **Size persistence** - Remember custom size between sessions

---

## Feedback

If you encounter issues or have suggestions:
- Document in test plan
- Update known issues section
- Propose enhancements in future features list

---

**Version**: 1.0  
**Last Updated**: 2025-10-08
