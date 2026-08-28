# Mero - AI-Powered Infinite Canvas

Mero is an infinite canvas application for visual thinking and creative work. It combines a freeform workspace with AI-powered tools for image generation and editing.

## Core Features

- **Infinite Canvas**: Pan and zoom freely across an unlimited workspace
- **Multiple Item Types**: Sticky notes, text boxes, shapes (with rounded corners), images, YouTube embeds, and frames for grouping
- **Multi-Board Management**: Create and organize multiple canvases with folders
- **User Accounts**: Register/login system with server-side data persistence
- **Voice Commands**: Create items hands-free using natural language (Ctrl+Alt+V)
- **AI Assistant**: Chat with Gemini AI, add responses directly to canvas
- **Export Options**: PNG, JPG, PDF, CSV

## Image Generation Stack

Mero uses **Fal.ai** for AI image capabilities:

- **Text-to-Image**: Flux model for generating images from text prompts
- **AI Image Editing**: Nano Banana model for natural language edits ("make it brighter", "add a sunset")

### Setup

1. Get an API key from [fal.ai](https://fal.ai)
2. Add to `.env.local`: `VITE_FAL_KEY=your_key_here`

### Usage

1. Add a shape to the canvas
2. Select it and click the sparkle icon (Generate Media) in the contextual toolbar
3. Enter a text prompt to generate an image
4. For editing: right-click an image → "Edit with AI" → describe your changes

## Tech Stack

**Frontend**: React 19, TypeScript, Vite, Tailwind CSS  
**Backend**: Express.js, SQLite, JWT authentication  
**AI**: Google Gemini (chat), Fal.ai (image generation/editing)
