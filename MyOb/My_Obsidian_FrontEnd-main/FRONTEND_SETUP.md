# Frontend Setup & Troubleshooting Guide

## What Was Fixed

### Issues Resolved:
1. **Missing Dependency**: Installed `@codemirror/language-data` package
2. **CodeMirror Extension Conflicts**: Simplified the `EnhancedMarkdownEditor` component to avoid extension compatibility issues
3. **Markdown Extensions**: Removed complex custom extensions that were causing "Unrecognized extension value" errors
4. **Package Compatibility**: Updated CodeMirror core packages to ensure compatibility

### Changes Made:
- **EnhancedMarkdownEditor.tsx**: Simplified to use only basic markdown and line wrapping extensions
- **markdown-extensions.ts**: Simplified frontmatter extension to avoid parser conflicts
- **Index.tsx**: Removed unused props from EnhancedMarkdownEditor calls
- **Dependencies**: Added `marked`, `@codemirror/language-data`, `@codemirror/state`, `@codemirror/view`, `@codemirror/commands`

## Running the Frontend

### Development Server
```powershell
# Navigate to the frontend directory
cd C:\Users\taylo\_New_Projects_Oct_1\My_Obsidian\My_Obsidian_FrontEnd-main

# Start the development server (in a new window)
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "npm run dev"
```

The server will start on `http://localhost:8080`

### Building for Production
```powershell
npm run build
npm run preview  # Preview production build
```

## Current Features

### Working Features:
- ✅ Split-pane markdown editor with live preview
- ✅ File browser with folder navigation
- ✅ Dark/Light theme toggle
- ✅ Command palette (Ctrl+P)
- ✅ Markdown syntax highlighting
- ✅ Auto-save indication
- ✅ File creation and deletion
- ✅ Line numbers and code folding

### Simplified Features:
- Basic markdown support (headers, bold, italic, lists, code)
- Simple line wrapping
- Standard CodeMirror keyboard shortcuts

### Not Yet Implemented:
- ❌ Backend integration (notes are stored in memory only)
- ❌ AI assistance features
- ❌ Semantic search
- ❌ Internal link completion
- ❌ Tag autocompletion
- ❌ YouTube video summarization

## Next Steps

### To Connect to Backend:
1. Update the frontend to make API calls to `http://localhost:8000`
2. Add API service layer in `src/lib/api.ts`
3. Replace mock data with real backend data
4. Implement note synchronization

### To Add Advanced Features:
1. Restore custom markdown extensions after fixing compatibility
2. Add AI assistance integration
3. Implement semantic search UI
4. Add video processing UI

## Architecture

### Component Structure:
```
src/
├── components/
│   ├── Editor/
│   │   ├── EnhancedMarkdownEditor.tsx  # Main editor component
│   │   ├── MarkdownPreview.tsx         # Preview pane
│   │   ├── EditorToolbar.tsx           # Top toolbar
│   │   ├── FileBrowser.tsx             # Sidebar file tree
│   │   └── CommandPalette.tsx          # Command search
│   ├── ThemeProvider.tsx               # Theme management
│   └── ui/                             # Shadcn UI components
├── pages/
│   └── Index.tsx                       # Main application page
├── lib/
│   ├── utils.ts                        # Utility functions
│   └── editor/
│       └── markdown-extensions.ts      # CodeMirror extensions
└── hooks/                              # React hooks
```

### Technology Stack:
- **React 18** with TypeScript
- **Vite** for build tooling
- **CodeMirror 6** for code editing
- **Tailwind CSS** for styling
- **Radix UI** for accessible components
- **React Router** for navigation
- **TanStack Query** for data fetching (not yet used)

## Troubleshooting

### White Screen Issue:
If you see a white screen, check the browser console (F12) for errors:
- CodeMirror extension errors → Update packages: `npm install`
- Import errors → Check file paths and component exports
- Theme errors → Verify ThemeProvider is wrapping the app

### Dev Server Not Starting:
```powershell
# Kill any existing node processes
Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue

# Clear node_modules and reinstall
Remove-Item -Recurse -Force node_modules
npm install

# Start again
npm run dev
```

### Hot Reload Not Working:
- Check that Vite server is running
- Verify file changes are being saved
- Try hard refresh in browser (Ctrl+Shift+R)

## Configuration

### Environment Variables:
Currently no environment variables are needed for the frontend. When connecting to the backend, create a `.env` file:
```
VITE_API_URL=http://localhost:8000
```

### Theme Customization:
Edit `src/index.css` to modify color schemes and CSS variables.

### Port Configuration:
Edit `vite.config.ts` to change the development server port (currently 8080).

## Known Issues

1. **CodeMirror Theme**: Custom markdown highlighting was removed to fix compatibility
2. **Memory Only**: Notes are not persisted - page refresh loses all changes
3. **No Backend Connection**: Frontend is currently standalone

## Support

For issues or questions:
1. Check browser console for error messages
2. Verify all dependencies are installed: `npm install`
3. Ensure development server is running in its own window
4. Check that no other service is using port 8080
