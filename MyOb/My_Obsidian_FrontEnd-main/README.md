# My Obsidian - AI-Powered Markdown Editor

A modern, fully-featured Obsidian-compatible markdown editor with AI-powered semantic search, YouTube video integration, and intuitive drag-and-drop organization.

![My Obsidian Editor](https://img.shields.io/badge/React-18.3.1-blue) ![FastAPI](https://img.shields.io/badge/FastAPI-Latest-green) ![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue) ![Python](https://img.shields.io/badge/Python-3.13-yellow)

## ✨ Features

### 🗂️ **Advanced File Management**
- **Drag & Drop Organization** - Intuitively organize notes by dragging them into folders
- **Folder Creation** - Create custom folders to structure your knowledge base
- **Hierarchical Navigation** - Expandable/collapsible folder tree with smart sorting
- **Resizable Sidebar** - Adjustable sidebar width for optimal workspace layout

### 📝 **Rich Markdown Experience**
- **YAML Frontmatter Support** - Full compatibility with Obsidian's metadata system
- **Dynamic Title Display** - Note titles automatically extracted and displayed
- **Tag Management** - Visual tag display from frontmatter metadata
- **Word Wrapping** - Proper text flow with responsive line breaks
- **Syntax Highlighting** - Enhanced editor with YAML and Markdown support

### 🎥 **YouTube Integration**
- **Auto Video Detection** - Paste YouTube URLs anywhere in your markdown
- **Seamless Embedding** - Automatic conversion to embedded video players
- **Multiple URL Formats** - Supports youtube.com and youtu.be links
- **Responsive Videos** - Video players adapt to screen size

### 🔍 **AI-Powered Search**
- **Semantic Search** - Find notes by meaning, not just keywords
- **Vector Embeddings** - Advanced AI understanding of content relationships
- **Smart Similarity** - Discover related notes automatically
- **Fast Results** - Instant search with relevance scoring

### 🎨 **Modern UI/UX**
- **Responsive Design** - Works seamlessly on desktop and mobile
- **Dark/Light Themes** - Toggle between themes with system preference detection
- **Three View Modes** - Edit, Preview, or Split view with Ctrl+E to cycle
- **Synchronized Scrolling** - Lock/unlock scroll sync in split view with button on resize handle
- **Adjustable Editor Width** - Obsidian-style width slider (40%-100%) for focused reading/writing
- **Status Bar** - Real-time word count, character count, and width control
- **Beautiful Animations** - Smooth transitions and hover effects
- **Professional Styling** - Modern gradients, shadows, and typography

### 🎨 **Advanced Customization** (NEW)
- **Accent Color Control** - Hue and brightness sliders for all UI accent colors (icons, buttons, highlights)
- **Text Brightness** - Global luminance control for all text throughout the app and preview window
- **Background Color** - Hue and brightness sliders for preview window background
- **Font Customization** - Separate font family and size controls for editor and preview with live preview
- **Theme Consistency** - All icons and UI elements automatically use your chosen accent color
- **Persistent Settings** - All customizations saved to localStorage and restored on startup
- **Real-time Updates** - See changes instantly as you adjust sliders and font settings
- **File Sorting Options** - 6 sort modes: name (asc/desc), created (new/old), modified (new/old)
- **Collapsible Folders** - Folders start collapsed by default for cleaner organization

## 🚀 Quick Start

### Prerequisites
- **Node.js** 16+ and npm
- **Python** 3.8+ with pip
- **Git** for version control

### Frontend Setup
```bash
# Clone the repository
git clone <your-repo-url>
cd My_Obsidian/My_Obsidian_FrontEnd-main

# Install dependencies
npm install

# Start development server
npm run dev
```

### Backend Setup
```bash
# Navigate to backend directory
cd ../backend

# Install Python dependencies
pip install fastapi uvicorn sqlalchemy python-frontmatter youtube-transcript-api

# Configure your Obsidian vault path
# Edit config.py and set VAULT_PATH to your Obsidian vault location

# Import your Obsidian notes
python import_notes.py

# Start the backend server
python runner.py
```

### Access the Application
- **Frontend**: http://localhost:8080
- **Backend API**: http://localhost:8001
- **API Documentation**: http://localhost:8001/docs

## 🛠️ Configuration

### Backend Configuration
Edit `backend/config.py`:
```python
# Path to your Obsidian vault
VAULT_PATH = "path/to/your/obsidian/vault"

# Database connection
DB_CONNECTION_STRING = "sqlite:///notes.db"

# API Keys (if using OpenAI for embeddings)
OPENAI_API_KEY = "your-api-key-here"
```

### Frontend Configuration
The frontend automatically connects to the backend at `http://localhost:8001`. If you need to change this, update `src/lib/api.ts`.

## 📚 Usage Guide

### Importing Your Obsidian Vault
1. **Set Vault Path** - Configure your Obsidian vault location in `backend/config.py`
2. **Run Import** - Execute `python import_notes.py` to import all notes
3. **Start Servers** - Run both frontend and backend servers
4. **Browse Notes** - Your Obsidian notes will appear in the sidebar with full metadata

### Creating and Organizing Notes
1. **New Notes** - Click "New Note" in the sidebar
2. **New Folders** - Click "Folder" to create organizational folders
3. **Drag & Drop** - Drag any note onto a folder to organize it
4. **Expand/Collapse** - Click folder icons to navigate the hierarchy

### YouTube Video Integration
Simply paste YouTube URLs anywhere in your markdown:
```markdown
Check out this video:
https://www.youtube.com/watch?v=dQw4w9WgXcQ

More content here...
```

The URL will automatically become an embedded video player in preview mode.

### View Modes & Editor Width
Customize your editing experience:
- **Ctrl+E** - Cycle through Edit → Preview → Split modes
- **Scroll Lock** - In split view, click the lock button on the resize handle to sync scrolling between editor and preview
- **Status Bar Slider** - Adjust editor/preview width from 40% to 100%
- **Centered Content** - Content centers automatically when width < 100%
- **Independent Widths** - Edit and Preview modes save separate width preferences
- **Word/Character Count** - Live statistics displayed in status bar

### Semantic Search
Use the search bar to find notes by meaning:
- **"machine learning concepts"** - Finds notes about ML, AI, algorithms
- **"productivity tips"** - Discovers notes about efficiency, workflow, habits
- **"javascript frameworks"** - Locates notes about React, Vue, Angular

### UI Customization
Personalize your editing experience via **Settings → Appearance**:

#### Accent Color
1. Open Settings (gear icon in sidebar)
2. Navigate to **Appearance** tab
3. Use the **Hue Picker** to choose any color
4. Adjust **Brightness** slider for darker/lighter tints (10-80%)
5. All toolbar icons, buttons, and links update instantly

#### Text Brightness
1. In Settings → Appearance, find **Text Brightness**
2. Adjust **Luminance** slider (10-96%)
3. Controls brightness of ALL text:
   - Toolbar and sidebar text
   - Editor text
   - Preview window content
4. Works independently of light/dark theme

#### Background Color (Preview Window)
1. In Settings → Appearance, find **Background Color**
2. Use **Hue Slider** to pick a background tint
3. Adjust **Brightness** slider for subtle darkness (3-20%)
4. Only affects the preview/reading pane
5. Combines with existing texture settings

#### File Sorting
1. Click the sort dropdown in the sidebar header
2. Choose from 6 options:
   - Name (A-Z or Z-A)
   - Created Date (Newest or Oldest First)
   - Modified Date (Newest or Oldest First)
3. Files re-sort instantly

#### Font Size & Family
1. In Settings → Appearance, find **Editor Font** and **Preview Font** sections
2. Choose from multiple font families:
   - Montserrat, Inter, Georgia, Roboto, JetBrains Mono, Merriweather
3. Adjust font size (12px-20px for editor, 14px-22px for preview)
4. **Live Preview**: Changes apply instantly to the respective window
5. See exactly how your text will look before saving

**Note**: All customizations save automatically to localStorage and persist across sessions!

## 🎯 Key Technologies

### Frontend Stack
- **React 18** - Modern React with hooks and concurrent features
- **TypeScript** - Type-safe JavaScript development
- **Vite** - Fast build tool and development server
- **Tailwind CSS** - Utility-first CSS framework
- **Shadcn/ui** - Beautiful, accessible component library
- **CodeMirror 6** - Advanced code/markdown editor
- **Lucide React** - Modern icon library

### Backend Stack
- **FastAPI** - High-performance Python API framework
- **SQLAlchemy** - Robust ORM for database operations
- **Python-Frontmatter** - YAML frontmatter parsing
- **YouTube Transcript API** - Video content analysis
- **OpenAI API** - AI embeddings for semantic search
- **Uvicorn** - Lightning-fast ASGI server

## 🤝 Contributing

We welcome contributions! Please:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'Add amazing feature'`)
4. **Push to the branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Obsidian** - Inspiration for the markdown-first approach
- **FastAPI Community** - Excellent documentation and examples
- **React Team** - For the amazing React ecosystem
- **Shadcn** - For the beautiful component library
- **All Contributors** - Who helped make this project better

---

**Made with ❤️ for the knowledge management community**
