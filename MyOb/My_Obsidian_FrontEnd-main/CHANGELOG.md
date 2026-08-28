# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added - 2025-10-08
- **Obsidian-style Editor Width Slider** - Inspired by the [obsidian-editor-width-slider](https://github.com/MugishoMp/obsidian-editor-width-slider) plugin
  - Status bar at bottom of editor and preview modes
  - Real-time word count and character count display
  - Width adjustment slider (40% - 100% in 5% increments)
  - Centered content when width is less than 100%
  - Independent width settings for Edit and Preview modes
  - Settings persist to localStorage
  - Smooth width transitions with CSS animations
  - Works in all view modes (Edit, Preview, Split)

### Components Added
- `src/components/Editor/EditorWidthSlider.tsx` - Status bar component with slider control

### Components Modified
- `src/components/Editor/EnhancedMarkdownEditor.tsx` - Added width control and status bar
- `src/components/Editor/MarkdownPreview.tsx` - Added width control and status bar

### Documentation Updated
- `README.md` - Added Editor Width Slider to features and usage guide
- `.warp` - Updated with new feature details and component structure

## Previous Features

### YouTube Integration
- Auto-detection and embedding of YouTube videos
- Graceful fallback for unavailable transcripts
- Support for multiple URL formats

### Import System
- Import Hotspot with Ctrl+Shift+I
- Bulk URL import from .txt files
- Single URL import with AI summarization
- Progress tracking for bulk imports

### File Management
- Drag & Drop organization
- Folder creation and management
- Hierarchical navigation
- Resizable sidebar

### Editor Features
- YAML Frontmatter support
- Three view modes (Edit, Preview, Split)
- Ctrl+E to cycle view modes
- Dark/Light theme toggle
- Syntax highlighting
- Word wrapping

### AI Features
- Semantic search with vector embeddings
- Content similarity detection
- Smart tag generation (optional)
