# 🛠️ Mero Tech Stack Documentation

**Project:** Mero - AI-Powered Infinite Canvas  
**Updated:** September 27, 2025  
**Purpose:** Comprehensive guide to all technologies, libraries, and tools used in the project

---

## 📋 Table of Contents

1. [Core Frontend Stack](#-core-frontend-stack)
2. [AI & Machine Learning Services](#-ai--machine-learning-services)
3. [Build Tools & Development](#-build-tools--development)
4. [UI/UX Libraries](#-uiux-libraries)
5. [Canvas & Graphics](#-canvas--graphics)
6. [Export & File Handling](#-export--file-handling)
7. [Browser APIs](#-browser-apis)
8. [Development Dependencies](#-development-dependencies)
9. [Configuration Files](#-configuration-files)
10. [Why We Chose Each Technology](#-why-we-chose-each-technology)

---

## 🚀 Core Frontend Stack

### **React 19.1.1**
- **Purpose:** Core UI library and component framework
- **Why React:** 
  - Excellent for complex, interactive UIs like infinite canvas
  - Strong ecosystem for AI integrations
  - Hooks provide clean state management
  - Virtual DOM for performance with many canvas items
- **Key Features Used:**
  - Functional components with hooks
  - State management with useState, useEffect
  - Custom hooks for canvas logic and speech recognition
  - Context API for global state
- **Documentation:** [React Official Docs](https://react.dev/)

### **TypeScript 5.8.2**
- **Purpose:** Type-safe JavaScript development
- **Why TypeScript:**
  - Prevents runtime errors in complex canvas interactions
  - Better IntelliSense for AI API integrations
  - Safer refactoring of large component trees
  - Interface definitions for complex data structures
- **Key Features Used:**
  - Interface definitions for BoardItem, AI responses
  - Generic types for reusable components
  - Strict null checks for canvas item handling
  - Type guards for AI API responses
- **Documentation:** [TypeScript Handbook](https://www.typescriptlang.org/docs/)

### **Vite 6.2.0**
- **Purpose:** Build tool and development server
- **Why Vite:**
  - Lightning-fast Hot Module Replacement (HMR)
  - Native ES modules support
  - Excellent TypeScript integration
  - Optimized production builds
- **Key Features Used:**
  - Environment variable handling for API keys
  - Plugin system for React support
  - Fast development server with instant updates
  - Tree-shaking for optimal bundle sizes
- **Configuration:** `vite.config.ts`
- **Documentation:** [Vite Guide](https://vitejs.dev/guide/)

---

## 🤖 AI & Machine Learning Services

### **Google Gemini API (@google/genai 1.21.0)**
- **Purpose:** Advanced conversational AI for the AI Assistant
- **Why Gemini:**
  - State-of-the-art language understanding
  - Streaming responses for real-time chat
  - Excellent context retention
  - Google's reliability and performance
- **Key Features Used:**
  - Chat sessions with history
  - Streaming text generation
  - Error handling and rate limiting
  - Custom prompting for creative workflows
- **Environment Variable:** `VITE_GEMINI_API_KEY`
- **Documentation:** [Google AI for Developers](https://ai.google.dev/)

### **Fal.ai Client (@fal-ai/client 1.6.2)**
- **Purpose:** AI image and video generation/editing platform
- **Why Fal.ai:**
  - Access to multiple cutting-edge models
  - Nano Banana for advanced image editing
  - Veo 2 for high-quality video generation
  - Simple API with excellent documentation
- **Models Integrated:**
  - **Nano Banana:** Google's image editing AI
  - **Veo 2 Fast:** Quick image-to-video conversion
  - **Future:** Flux (text-to-image), Veo 2 (text-to-video)
- **Key Features Used:**
  - File upload to Fal storage
  - Real-time progress tracking
  - Error handling for failed generations
  - Result caching and history
- **Environment Variable:** `VITE_FAL_KEY`
- **Documentation:** [Fal.ai Documentation](https://fal.ai/docs)

### **Web Speech API (Browser Native)**
- **Purpose:** Speech-to-text functionality
- **Why Web Speech API:**
  - Native browser support (no external dependencies)
  - Real-time speech recognition
  - Cross-browser compatibility
  - No additional API costs
- **Key Features Used:**
  - Continuous speech recognition
  - Interim results for real-time feedback
  - Error handling for unsupported browsers
  - Visual feedback states
- **Browser Support:** Chrome, Edge, Safari (WebKit)
- **Documentation:** [MDN Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)

---

## 🔧 Build Tools & Development

### **@vitejs/plugin-react 5.0.0**
- **Purpose:** React support for Vite build system
- **Features:** JSX transformation, Fast Refresh, React DevTools
- **Documentation:** [Vite React Plugin](https://github.com/vitejs/vite-plugin-react)

### **@types/node 22.14.0**
- **Purpose:** TypeScript definitions for Node.js APIs
- **Usage:** Path resolution, file system operations in build scripts
- **Documentation:** [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped)

---

## 🎨 UI/UX Libraries

### **Tailwind CSS (via CDN)**
- **Purpose:** Utility-first CSS framework for rapid styling
- **Why Tailwind:**
  - Rapid prototyping and development
  - Consistent design system
  - Small bundle size (purged unused styles)
  - Excellent responsive design utilities
- **Key Features Used:**
  - Flexbox and Grid layouts
  - Dark theme color palette
  - Hover and focus states
  - Animation utilities (pulse, spin)
  - Responsive breakpoints
- **Classes Used Heavily:**
  - `bg-gray-800`, `text-white` (dark theme)
  - `hover:bg-gray-700` (interactive states)
  - `animate-pulse`, `animate-spin` (loading states)
  - `fixed`, `absolute` (modal positioning)
- **Documentation:** [Tailwind CSS](https://tailwindcss.com/docs)

### **Custom Icon System (icons.tsx)**
- **Purpose:** Comprehensive SVG icon library
- **Why Custom Icons:**
  - Consistent visual style
  - Small bundle size (only icons used)
  - Easy customization and theming
  - No external dependencies
- **Icon Categories:**
  - UI actions (close, edit, download)
  - Canvas tools (shapes, text, zoom)
  - AI features (microphone, bot, image edit)
  - Media controls (play, pause, maximize)
- **Total Icons:** ~40 custom SVG icons

---

## 🎯 Canvas & Graphics

### **D3.js 7.9.0**
- **Purpose:** Advanced canvas interactions and data visualization
- **Why D3:**
  - Excellent zoom and pan behavior
  - Smooth animations and transitions
  - Event handling for complex interactions
  - Mathematical utilities for transformations
- **Key Features Used:**
  - `d3-zoom` for canvas navigation
  - `d3-selection` for DOM manipulation
  - `d3-drag` for item movement
  - Transform calculations for pan/zoom
- **Usage Areas:**
  - Canvas viewport management
  - Smooth zoom transitions
  - Coordinate transformations
  - Interactive item positioning
- **Documentation:** [D3.js API Reference](https://d3js.org/)

### **Custom Canvas Implementation**
- **Components:**
  - `Board.tsx` - Main canvas container
  - `BoardItemComponent.tsx` - Individual canvas items
  - `useBoard.ts` - Canvas state management
- **Features:**
  - Infinite scrolling canvas
  - Multi-select with Shift+Click
  - Drag and drop from desktop
  - Resize handles with visual feedback
  - Rotation controls for supported items
  - Layering (z-index) management

---

## 📄 Export & File Handling

### **html2canvas 1.4.1**
- **Purpose:** Convert DOM elements to canvas for image export
- **Why html2canvas:**
  - Captures complex CSS layouts
  - Handles text, images, and shapes
  - Cross-browser compatibility
  - No server-side dependencies
- **Usage:**
  - PNG/JPG export of entire canvas
  - Individual item screenshots
  - High-resolution exports
- **Documentation:** [html2canvas GitHub](https://github.com/niklasvh/html2canvas)

### **jsPDF 2.5.1**
- **Purpose:** PDF generation from canvas content
- **Why jsPDF:**
  - Client-side PDF creation
  - Vector graphics support
  - Multiple page layouts
  - No server dependencies
- **Usage:**
  - Export canvas as PDF document
  - Multi-page exports for large canvases
  - Vector text preservation
- **Documentation:** [jsPDF Documentation](https://github.com/parallax/jsPDF)

### **Native File API**
- **Purpose:** Drag-and-drop file handling
- **Features Used:**
  - FileReader for image processing
  - Drag events for canvas drop zones
  - File type validation
  - Image preview generation

---

## 🌐 Browser APIs

### **localStorage**
- **Purpose:** Persist user preferences and settings
- **Data Stored:**
  - Canvas background color
  - Toolbar position preference
  - Grid density settings
  - Recent AI prompts (future)
- **Storage Keys:**
  - `infinite-canvas-bg-color`
  - `infinite-canvas-dot-density`
  - `infinite-canvas-toolbar-position`

### **Clipboard API**
- **Purpose:** Copy AI responses and canvas content
- **Usage:**
  - Copy AI chat responses
  - Copy canvas item text
  - Future: Copy/paste canvas items

### **File System Access API (Future)**
- **Purpose:** Direct file system integration
- **Potential Uses:**
  - Save/load canvas projects
  - Direct image file access
  - Project file management

---

## 🛠️ Development Dependencies

### **TypeScript Compiler**
- **Version:** 5.8.2
- **Purpose:** Compile TypeScript to JavaScript
- **Configuration:** `tsconfig.json`
- **Features:** Strict type checking, ES2022 target

### **Vite Development Server**
- **Purpose:** Local development environment
- **Features:**
  - Hot Module Replacement
  - Fast builds
  - Environment variable injection
  - Proxy for API calls (if needed)

---

## ⚙️ Configuration Files

### **package.json**
- **Purpose:** Project metadata and dependencies
- **Scripts:**
  - `dev` - Start development server
  - `build` - Production build
  - `preview` - Preview production build

### **tsconfig.json**
- **Purpose:** TypeScript compiler configuration
- **Key Settings:**
  - `strict: true` - Maximum type safety
  - `target: "ES2022"` - Modern JavaScript features
  - `moduleResolution: "bundler"` - Vite compatibility

### **vite.config.ts**
- **Purpose:** Build tool configuration
- **Key Features:**
  - React plugin setup
  - Environment variable mapping
  - Development server configuration
  - Path aliases for imports

### **.env.local**
- **Purpose:** Environment variables (not committed to git)
- **Variables:**
  - `VITE_GEMINI_API_KEY` - Google AI API key
  - `VITE_FAL_KEY` - Fal.ai API key

---

## 🎯 Why We Chose Each Technology

### **Frontend Framework Decision: React**
**Considered:** Vue.js, Svelte, Angular  
**Chosen:** React  
**Reasons:**
- Best ecosystem for AI integrations
- Excellent TypeScript support
- Mature Canvas libraries available
- Strong community for complex UIs
- Hooks perfect for canvas state management

### **Build Tool Decision: Vite**
**Considered:** Webpack, Parcel, Rollup  
**Chosen:** Vite  
**Reasons:**
- Fastest development experience
- Native ES modules
- Excellent TypeScript integration
- Small config footprint
- Plugin ecosystem

### **Styling Decision: Tailwind CSS**
**Considered:** Styled Components, Emotion, CSS Modules  
**Chosen:** Tailwind  
**Reasons:**
- Rapid development for MVP
- Consistent design system
- No JavaScript runtime overhead
- Easy responsive design
- Great for prototyping

### **AI Service Decisions:**

**Gemini vs GPT-4 vs Claude:**
- Chose **Gemini** for streaming capabilities and Google integration

**Fal.ai vs Replicate vs OpenAI:**
- Chose **Fal.ai** for model variety and simple API

**Web Speech API vs Deepgram vs AssemblyAI:**
- Chose **Web Speech API** for zero cost and privacy

### **Canvas Implementation: Custom vs Libraries**
**Considered:** Fabric.js, Konva.js, Paper.js  
**Chosen:** Custom with D3.js  
**Reasons:**
- Full control over interactions
- Lighter weight than full canvas libraries
- D3.js provides exactly what we need
- Easier AI integration with custom components

---

## 📊 Bundle Analysis

### **Production Bundle Size** (estimated):
- **React + ReactDOM:** ~45KB gzipped
- **D3.js:** ~30KB gzipped
- **AI Client Libraries:** ~25KB gzipped
- **Custom Code:** ~40KB gzipped
- **Total:** ~140KB gzipped

### **Performance Characteristics:**
- **First Load:** ~200ms on fast connection
- **Canvas Interaction:** 60 FPS smooth animations
- **AI Response Time:** 1-3 seconds (API dependent)
- **Memory Usage:** ~50MB for large canvases

---

## 🔮 Technology Roadmap

### **Potential Future Additions:**
- **React Query:** For better AI API state management
- **Zustand:** For complex global state
- **Framer Motion:** For advanced animations
- **Web Workers:** For heavy canvas operations
- **PWA APIs:** For offline functionality
- **WebRTC:** For real-time collaboration

### **Possible Replacements:**
- **Canvas Libraries:** If custom implementation becomes limiting
- **State Management:** If React state becomes insufficient
- **AI Services:** As new models become available

---

## 📚 Learning Resources

### **For React Development:**
- [React Official Tutorial](https://react.dev/learn)
- [React Patterns](https://reactpatterns.com/)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)

### **For Canvas/Graphics:**
- [D3.js Documentation](https://d3js.org/)
- [Canvas API Guide](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [HTML5 Canvas Tutorials](https://www.html5canvastutorials.com/)

### **For AI Integration:**
- [Google AI Documentation](https://ai.google.dev/)
- [Fal.ai Model Gallery](https://fal.ai/models)
- [OpenAI API Reference](https://platform.openai.com/docs)

### **For TypeScript:**
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Type Challenges](https://github.com/type-challenges/type-challenges)

---

**Last Updated:** September 27, 2025  
**Next Review:** When adding new major features or dependencies

This tech stack provides a solid foundation for an AI-powered creative application with room for future growth and optimization.