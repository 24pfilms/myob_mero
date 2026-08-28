import { useEffect, useState, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EditorWidthSlider } from './EditorWidthSlider';

interface MarkdownPreviewProps {
  content: string;
  scrollLocked?: boolean;
  scrollTarget?: string;
  fontFamily?: string;
  fontSize?: number;
  backgroundBrightness?: number;
  backgroundTexture?: string;
  textureIntensity?: number;
  textureScale?: number;
  textureColor?: string;
  gridLineThickness?: number;
  gridStyle?: string;
  textColor?: string;
  textLuminance?: number;
  backgroundColorHue?: number;
  backgroundColorSaturation?: number;
  backgroundColorLightness?: number;
}

export const MarkdownPreview = ({ content, scrollLocked = false, scrollTarget = 'editor', fontFamily = 'Inter', fontSize = 16, backgroundBrightness = 100, backgroundTexture = 'none', textureIntensity = 50, textureScale = 1.0, textureColor = '#000000', gridLineThickness = 1, gridStyle = 'square', textColor = 'black', textLuminance = 96, backgroundColorHue = 240, backgroundColorSaturation = 10, backgroundColorLightness = 8 }: MarkdownPreviewProps) => {
  const [html, setHtml] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);
  const [previewWidth, setPreviewWidth] = useState<number>(() => {
    // Load from localStorage or default to 100%
    const saved = localStorage.getItem('previewWidth');
    return saved ? parseInt(saved, 10) : 100;
  });

  // Save width to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('previewWidth', previewWidth.toString());
  }, [previewWidth]);

  useEffect(() => {
    // Simple markdown to HTML converter
    const convertMarkdown = (markdown: string) => {
      let result = markdown;

      // CRITICAL: Process images FIRST before anything else!
      // Extract and store base64 images as placeholders first
      const imageMap = new Map<string, string>();
      let imageCounter = 0;
      
      // Match base64 images - use pattern that captures full base64 data
      // Format: ![alt|width](data:image/type;base64,DATA)
      // Base64 data can be very long, so we need a greedy pattern
      const imageRegex = /!\[([^\]]*)\]\((data:image\/[a-z]+;base64,[A-Za-z0-9+\/=]+)\)/g;
      
      result = result.replace(imageRegex, (match, altText, src) => {
        console.log('[MarkdownPreview] Processing image, alt:', altText, 'src length:', src.length);
        
        if (src.startsWith('data:image/')) {
          // Extract width if present in alt text
          let alt = altText;
          let widthStyle = '';
          let width: number | null = null;
          const widthMatch = altText.match(/^(.*)\|(\d+)$/);
          if (widthMatch) {
            alt = widthMatch[1];
            width = parseInt(widthMatch[2], 10);
            if (!isNaN(width)) {
              widthStyle = ` style="max-width:${width}px;width:100%;height:auto;"`;
            }
          }
          
          const placeholder = `___IMAGE_${imageCounter++}___`;
          const imgTag = `<img src="${src}" alt="${alt}" class="generated-image"${widthStyle} />`;
          imageMap.set(placeholder, imgTag);
          console.log('[MarkdownPreview] Stored image as placeholder:', placeholder, 'width:', width || 'default');
          return placeholder;
        }
        return match;
      });
      
      // Regular images (non-base64)
      result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
        if (!src.startsWith('data:')) {
          return `<img src="${src}" alt="${alt}" />`;
        }
        return match; // Already handled above
      });

      // YouTube URLs - simple replacement with basic iframe
      result = result.replace(/https:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/g, 
        '<iframe width="560" height="315" src="https://www.youtube.com/embed/$1" title="YouTube video" frameborder="0" allowfullscreen></iframe>');
      
      result = result.replace(/https:\/\/youtu\.be\/([a-zA-Z0-9_-]{11})/g, 
        '<iframe width="560" height="315" src="https://www.youtube.com/embed/$1" title="YouTube video" frameborder="0" allowfullscreen></iframe>');

      // Headers
      result = result.replace(/^### (.*$)/gim, '<h3>$1</h3>');
      result = result.replace(/^## (.*$)/gim, '<h2>$1</h2>');
      result = result.replace(/^# (.*$)/gim, '<h1>$1</h1>');

      // YAML frontmatter - strip completely for clean preview (no visible markup)
      if (result.trim().startsWith('---')) {
        result = result.replace(/^---\n[\s\S]*?\n---\n?/m, '');
      }
      
      // Code blocks (must be before inline code)
      result = result.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

      // Bold
      result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

      // Italic
      result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');

      // Code inline (must be after images are already processed)
      result = result.replace(/`(.+?)`/g, '<code>$1</code>');

      // Links (must be after images)
      result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

      // Lists
      result = result.replace(/^\* (.+)$/gim, '<li>$1</li>');
      result = result.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

      // Line breaks (last, after everything else)
      result = result.replace(/\n/g, '<br />');

      // FINAL STEP: Restore base64 images from placeholders
      // This ensures they are not touched by any other regex
      imageMap.forEach((imgTag, placeholder) => {
        result = result.replace(placeholder, imgTag);
      });
      
      console.log('[MarkdownPreview] Final result length:', result.length, 'Images restored:', imageMap.size);

      return result;
    };

    setHtml(convertMarkdown(content));
  }, [content]);

  // Scroll synchronization - send scroll events from preview to editor
  useEffect(() => {
    if (!scrollLocked) return;

    // Wait for ScrollArea to be ready
    const timer = setTimeout(() => {
      const scrollArea = scrollContainerRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
      if (!scrollArea) return;

      const handleScroll = () => {
        if (isScrollingRef.current) {
          isScrollingRef.current = false;
          return;
        }

        const scrollPercentage = scrollArea.scrollTop / (scrollArea.scrollHeight - scrollArea.clientHeight);
        
        // Dispatch custom event to sync with editor
        window.dispatchEvent(new CustomEvent('preview-scroll', {
          detail: { scrollPercentage, source: 'preview' }
        }));
      };

      scrollArea.addEventListener('scroll', handleScroll);
      
      return () => {
        scrollArea.removeEventListener('scroll', handleScroll);
      };
    }, 100);

    return () => clearTimeout(timer);
  }, [scrollLocked]);

  // Listen for editor scroll events
  useEffect(() => {
    if (!scrollLocked) return;

    const handleEditorScroll = (e: any) => {
      if (e.detail.source === 'editor' && scrollContainerRef.current) {
        const scrollArea = scrollContainerRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
        if (scrollArea) {
          isScrollingRef.current = true;
          const scrollPosition = e.detail.scrollPercentage * (scrollArea.scrollHeight - scrollArea.clientHeight);
          scrollArea.scrollTop = scrollPosition;
        }
      }
    };

    window.addEventListener('editor-scroll', handleEditorScroll);
    return () => {
      window.removeEventListener('editor-scroll', handleEditorScroll);
    };
  }, [scrollLocked]);

  // Get background styles
  const getBackgroundColor = () => {
    // Use background color hue, saturation, and lightness for colored background
    return `hsl(${backgroundColorHue}, ${backgroundColorSaturation}%, ${backgroundColorLightness}%)`;
  };

  const getTextureColorRgb = () => {
    // Convert hex to RGB
    const hex = textureColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `${r}, ${g}, ${b}`;
  };

  const getBackgroundImage = () => {
    const opacity = textureIntensity / 100;
    const colorRgb = getTextureColorRgb();
    
    switch (backgroundTexture) {
      case 'paper':
        return `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='${opacity * 0.5}'/%3E%3C/svg%3E")`;
      case 'linen':
        return `url("data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 20h20M20 0v20M0 0l20 20M0 20l20-20' stroke='rgba(0,0,0,${opacity * 0.4})' stroke-width='0.5'/%3E%3C/svg%3E")`;
      case 'grid':
        return `linear-gradient(rgba(${colorRgb},${opacity * 0.4}) ${gridLineThickness}px, transparent ${gridLineThickness}px), linear-gradient(90deg, rgba(${colorRgb},${opacity * 0.4}) ${gridLineThickness}px, transparent ${gridLineThickness}px)`;
      case 'dots':
        return `radial-gradient(circle, rgba(${colorRgb},${opacity * 0.5}) 1px, transparent 1px)`;
      case 'noise':
        return `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='${opacity * 0.6}'/%3E%3C/svg%3E")`;
      default:
        return undefined;
    }
  };

  const getBackgroundSize = () => {
    if (backgroundTexture === 'grid') {
      const baseSize = 10;
      const scaledSize = Math.round(baseSize * textureScale);
      // Different grid styles affect the pattern dimensions
      switch (gridStyle) {
        case 'wide':
          return `${scaledSize * 2}px ${scaledSize}px`; // Horizontal rectangles
        case 'tall':
          return `${scaledSize}px ${scaledSize * 2}px`; // Vertical rectangles
        case 'dense':
          return `${scaledSize / 2}px ${scaledSize / 2}px`; // Smaller, tighter grid
        default: // square
          return `${scaledSize}px ${scaledSize}px`;
      }
    }
    
    // Other textures
    const baseSize = backgroundTexture === 'dots' ? 10 : backgroundTexture === 'linen' ? 20 : backgroundTexture === 'paper' ? 50 : null;
    if (baseSize) {
      const scaledSize = Math.round(baseSize * textureScale);
      return `${scaledSize}px ${scaledSize}px`;
    }
    return 'auto';
  };

  const getTextColor = () => {
    // Use text luminance to create HSL color (240 hue = blue-ish gray, 5% saturation = nearly neutral)
    return `hsl(240, 5%, ${textLuminance}%)`;
  };

  const backgroundStyles = {
    backgroundColor: getBackgroundColor(),
    backgroundImage: getBackgroundImage(),
    backgroundSize: getBackgroundSize(),
    // Use the text luminance setting
    color: getTextColor(),
  };

  // Debug logging
  useEffect(() => {
    console.log('[MarkdownPreview] Background settings:', {
      backgroundBrightness,
      backgroundTexture,
      textureIntensity,
      textureScale,
      textureColor,
      computedBgColor: getBackgroundColor(),
      computedBgImage: getBackgroundImage()?.substring(0, 100),
      computedBgSize: getBackgroundSize()
    });
  }, [backgroundBrightness, backgroundTexture, textureIntensity, textureScale, textureColor]);

  return (
    <div className="h-full flex flex-col overflow-hidden" style={backgroundStyles}>
      <ScrollArea className="flex-1" ref={scrollContainerRef}>
        <style>{`
          .generated-image {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            margin: 1rem 0;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            display: block;
          }
        `}</style>
        <div className="flex justify-center">
          <div 
            style={{ 
              width: `${previewWidth}%`,
              maxWidth: '100%',
              transition: 'width 0.2s ease'
            }}
          >
            <div
              className="prose dark:prose-invert max-w-none p-6 prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-em:text-muted-foreground prose-code:text-primary prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-a:text-primary hover:prose-a:text-primary-glow"
              style={{
                fontFamily: `'${fontFamily}', sans-serif`,
                fontSize: `${fontSize}px`
              }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        </div>
      </ScrollArea>
      <EditorWidthSlider 
        onWidthChange={setPreviewWidth}
        initialWidth={previewWidth}
        content={content}
      />
    </div>
  );
};
