# Obsidian Notes Integration for Mero

## Overview

Mero now supports importing and displaying Obsidian notes as scalable, interactive canvas items. This creates a powerful visual knowledge workspace that combines your existing notes with infinite canvas capabilities.

## Features Implemented

### 🎯 **Scalable Note Rendering**
- **4 Display Modes** based on zoom level and item size:
  - **Icon**: Small file icon for overview
  - **Preview**: Title, word count, and preview text
  - **Content**: Full metadata with tags and links
  - **Detailed**: Complete markdown rendering with formatting

### 🔍 **Smart Vault Browser**
- Modern File System Access API support (Chrome/Edge)
- Fallback to file input for other browsers
- Recursive directory reading with markdown file detection
- Search functionality across file names, content, and tags
- Tag-based filtering and sorting options

### 📝 **Rich Note Display**
- **Markdown Parsing**: Headers, bold, italic, code blocks
- **Obsidian Features**: Wikilinks `[[note]]` and tags `#tag`
- **Metadata Display**: File info, word count, last modified
- **Interactive Elements**: Hover states and selection feedback

### 🎨 **Visual Integration**
- **Purple Theme**: Distinctive color scheme for notes
- **Gradient Backgrounds**: Professional visual hierarchy
- **Smooth Animations**: Scale transitions and hover effects
- **Contextual Sizing**: Content adapts to available space

## How to Use

### 1. **Import Obsidian Notes**
- Click the **Obsidian Vault** button (folder icon) in the toolbar
- Select your Obsidian vault directory
- Browse, search, and filter your notes
- Click "Add to Canvas" to import any note

### 2. **Interact with Notes**
- **Scale Notes**: Resize to see different detail levels
- **Zoom Canvas**: Different zoom levels reveal more/less detail
- **Move & Position**: Drag notes around like any other item
- **Standard Controls**: Select, resize, rotate, layer management

### 3. **Scale-Dependent Viewing**
- **Zoom Out**: See notes as simple icons for overview
- **Medium Zoom**: Preview with titles and basic info
- **Zoom In**: Full content with tags and links
- **Maximum Detail**: Complete markdown rendering

## Technical Implementation

### New Item Type
```typescript
ItemType.ObsidianNote = 'OBSIDIAN_NOTE'
```

### Extended BoardItem Interface
```typescript
interface BoardItem {
  // ... existing properties
  obsidianData?: {
    filePath: string;
    fileName: string;
    markdownContent: string;
    lastModified: number;
    tags?: string[];
    links?: string[];
    wordCount?: number;
  };
  scaleThresholds?: {
    preview: number;
    content: number; 
    detailed: number;
  };
}
```

### Key Components Added

1. **ObsidianNoteComponent**: Scale-aware note renderer
2. **ObsidianVaultPanel**: Vault browser and import interface
3. **Enhanced BoardItemComponent**: Supports ObsidianNote type
4. **Updated Toolbar**: Vault access button

### File Structure
```
components/
├── ObsidianNoteComponent.tsx    # Scale-dependent note display
├── ObsidianVaultPanel.tsx       # Vault browser modal
├── BoardItemComponent.tsx       # Updated with ObsidianNote support
├── Toolbar.tsx                  # Added vault button
└── icons.tsx                    # Added required icons

types.ts                         # Extended with ObsidianNote types
App.tsx                         # Integrated vault panel
```

## Browser Compatibility

### Modern Browsers (Recommended)
- **Chrome 86+**: Full File System Access API
- **Edge 86+**: Full File System Access API
- **Direct folder access** with recursive reading

### Fallback Support
- **Other Browsers**: File input fallback
- **Multi-file selection** of .md files
- **Same functionality** with manual file selection

## Use Cases

### 📚 **Research & Study**
- Import research notes as visual knowledge map
- Scale notes based on importance/detail needed
- Create visual connections between concepts
- Overview and dive into specific topics

### 🧠 **Brainstorming & Planning**
- Bring existing notes into brainstorming sessions
- Combine notes with new ideas on the canvas
- Visual project planning with note integration
- Team collaboration with shared knowledge

### 📝 **Writing & Content Creation**
- Visual outline creation from existing notes
- Story/article structure mapping
- Reference material organization
- Character/topic relationship visualization

### 💼 **Knowledge Management**
- Transform linear notes into spatial relationships
- Create visual dashboards from text notes
- Meeting preparation with relevant note compilation
- Project documentation visualization

## Future Enhancements

### Phase 2 Potential Features
- **Bi-directional sync**: Save canvas changes back to .md files
- **Live file watching**: Auto-update when notes change
- **Link following**: Click wikilinks to add connected notes
- **Note creation**: Create new notes directly from canvas
- **Template integration**: Note templates for consistent formatting

### Advanced Features
- **Graph view**: Automatic link-based note connections
- **AI summarization**: Generate note summaries for preview
- **Cross-vault support**: Multiple vault management
- **Plugin integration**: Support for Obsidian plugin data

## Security & Privacy

- **Local Processing**: All note parsing happens locally
- **No Cloud Storage**: Notes remain on your machine
- **Explicit Permissions**: User must grant folder access
- **Read-Only Access**: Cannot modify original notes (current version)
- **Selective Import**: Choose which notes to add to canvas

## Performance Considerations

- **Lazy Loading**: Notes load content only when needed
- **Efficient Parsing**: Minimal regex processing for markdown
- **Scale-Based Rendering**: Reduces DOM complexity at small sizes
- **Memory Management**: Large note content handled efficiently

This integration transforms Mero from a visual canvas tool into a comprehensive knowledge workspace that bridges the gap between your structured notes and spatial thinking!