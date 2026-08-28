# Mero Project Overview - Research Document

## What Mero Is

### Core Concept
- **Infinite Canvas Application**: A web-based workspace with unlimited scrollable/zoomable area
- **AI-Powered Creative Tool**: Combines traditional canvas functionality with modern AI capabilities
- **Visual Collaboration Platform**: Digital whiteboard with intelligent features

### Primary Use Cases
- **Creative Brainstorming**: Visual mind mapping and idea organization
- **AI-Assisted Content Creation**: Generate and edit images/videos using AI
- **Educational Tool**: Interactive learning with AI explanations
- **Project Planning**: Visual project management with multimedia elements
- **Research Organization**: Collect, organize, and connect information visually

## Technical Architecture

### Frontend Technology Stack
- **React 19.1.1**: Latest React with concurrent features
- **TypeScript 5.8.2**: Type-safe JavaScript development
- **Vite 6.2.0**: Fast build tool and development server
- **Tailwind CSS**: Utility-first CSS framework
- **D3.js 7.9.0**: Data visualization and canvas interactions

### AI Service Integrations
- **Google Gemini API**: Advanced conversational AI for chat assistance
- **Fal.ai Services**: 
  - Nano Banana model for AI image editing
  - Veo 2 Fast model for image-to-video generation
- **Web Speech API**: Browser-native speech-to-text functionality

### Canvas Engine
- **Custom Implementation**: Built from scratch using React and D3.js
- **Pan/Zoom System**: Smooth navigation with mouse/touch controls
- **Item Management**: Dynamic creation, manipulation, and layering of objects
- **Transform System**: CSS-based positioning with coordinate conversion

## Feature Categories

### 1. Canvas Fundamentals
- **Infinite Workspace**: Unlimited 2D space for content
- **Pan & Zoom**: Mouse wheel zoom, drag to pan navigation
- **Multi-Item Support**: Sticky notes, text boxes, shapes, images, videos
- **Drag & Drop**: File upload by dropping onto canvas
- **Item Manipulation**: Resize, rotate, move, layer management
- **Export Options**: PNG, JPG, PDF, CSV formats

### 2. AI Integration Features
- **AI Assistant Modal**: 
  - Gemini-powered conversational AI
  - Streaming real-time responses
  - Speech-to-text input capability
  - Convert AI responses to canvas sticky notes
- **AI Image Editing**:
  - Natural language editing commands ("make it brighter")
  - Nano Banana model for intelligent image modifications
  - Edit history tracking
  - Preview before applying changes
- **AI Video Generation**:
  - Convert static images to dynamic videos
  - Custom motion prompts
  - Multiple aspect ratios and durations

### 3. Speech Recognition System
- **Multi-Context Support**: Available in AI chat, text editing, sticky notes
- **Visual Feedback System**: Color-coded status (red=listening, green=success)
- **Cross-Browser Compatibility**: WebKit and standard Speech API support
- **Smart Text Integration**: Appends to existing content intelligently

### 4. Media Management
- **YouTube Integration**: Embed videos with native controls
- **Image Controls**: Maximize/minimize, crop, rotate functionality
- **Download System**: Save generated content and imported media
- **Context Menus**: Right-click access to media-specific actions

### 5. User Interface Design
- **Flexible Toolbar**: Repositionable (top/left/bottom/right)
- **Context-Aware Menus**: Right-click menus based on item type
- **Keyboard Shortcuts**: Efficient workflow controls
- **Responsive Design**: Adapts to different screen sizes
- **Dark Theme**: Professional, eye-friendly appearance

## Technical Challenges & Solutions

### 1. Coordinate Conversion System
- **Challenge**: Converting mouse coordinates to canvas coordinates during pan/zoom
- **Current Formula**: `(screenPos / panZoom.k) - panZoom.x`
- **Status**: Under investigation for accuracy improvements
- **Impact**: Minor positioning adjustments needed after item placement

### 2. State Management
- **Custom Hooks Architecture**: useBoard.ts manages complex canvas state
- **Item Lifecycle**: Creation, manipulation, deletion, and persistence
- **Interaction States**: Selection, editing, dragging, resizing modes

### 3. Performance Optimization
- **Rendering Efficiency**: Optimized React rendering for large item counts
- **Memory Management**: Efficient image/video handling
- **Animation Smoothness**: CSS transforms for 60fps interactions

## Market Position & Competitive Analysis

### Similar Tools (Research Targets)
- **Miro/Mural**: Professional whiteboarding platforms
- **Figma**: Design-focused collaborative canvas
- **Conceptboard**: Business-oriented visual collaboration
- **Excalidraw**: Open-source drawing and diagramming

### Unique Differentiators
- **AI-First Approach**: Native AI integration vs. bolt-on features
- **Speech Recognition**: Voice input across all contexts
- **Image-to-Video**: Advanced AI video generation capabilities
- **Open Source**: MIT license vs. proprietary competitors
- **Modern Tech Stack**: React 19 with latest web technologies

## Business Model Research Areas

### Potential Revenue Streams
- **Freemium SaaS**: Basic free tier, advanced AI features paid
- **API Credits**: Pay-per-use AI generation and editing
- **Enterprise Licensing**: Custom deployment for businesses
- **White-Label Solutions**: Branded versions for other companies

### Target Markets
- **Creative Professionals**: Designers, artists, content creators
- **Educational Institutions**: Teachers, students, researchers
- **Business Teams**: Project managers, consultants, strategists
- **Developers**: Technical teams using visual planning

## Development Status

### Current State
- **Fully Functional**: All core features working
- **Production Ready**: Stable and deployable
- **AI Integration**: Complete with multiple AI models
- **Export System**: Multiple format support implemented

### Known Limitations
- **Coordinate Precision**: Minor alignment issues during pan/zoom
- **Mobile Optimization**: Primarily desktop-focused currently
- **Collaboration**: Single-user experience (no real-time sharing)

## Research Directions

### Technical Research
- **Canvas Performance**: Investigate WebGL for better rendering
- **Collaborative Features**: Real-time multi-user synchronization
- **Mobile Optimization**: Touch-optimized interface design
- **AI Model Integration**: Additional AI service providers

### Market Research
- **User Interviews**: Validate use cases and feature priorities
- **Competitive Analysis**: Feature gap analysis vs. existing tools
- **Pricing Strategy**: AI credit costs and subscription modeling
- **Partnership Opportunities**: Integration with existing platforms

### Legal/Business Research
- **AI Model Licensing**: Terms of service for Gemini/Fal.ai
- **Data Privacy**: User content handling and storage policies
- **International Markets**: Localization and compliance requirements
- **Patent Landscape**: AI-assisted canvas innovation patents

## Getting Started for Research

### Setup Requirements
- Node.js 18+ environment
- Google Gemini API key (free tier available)
- Fal.ai API key for AI image/video features
- Modern web browser with Speech API support

### Key Files to Understand
- `App.tsx`: Main application logic and tool coordination
- `useBoard.ts`: Canvas state management and item lifecycle
- `AiAssistantModal.tsx`: AI chat interface and speech integration
- `Board.tsx`: Core canvas rendering and interaction handling
- `vite.config.ts`: Build configuration and environment setup

### Research Questions to Explore
1. How does this compare to existing infinite canvas tools?
2. What's the market size for AI-powered creative tools?
3. How can the coordinate conversion accuracy be improved?
4. What collaboration features are most needed?
5. How should AI usage be priced and monitored?
6. What are the scalability requirements for multi-user support?
7. How can mobile/tablet experience be optimized?
8. What additional AI models could enhance the platform?

---

**Document Purpose**: This overview provides structured talking points for research into market positioning, technical improvements, and business development opportunities for the Mero infinite canvas platform.