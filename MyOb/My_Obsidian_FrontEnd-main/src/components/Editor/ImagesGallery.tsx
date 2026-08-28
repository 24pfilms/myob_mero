import { useState, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { X, Image as ImageIcon, Copy, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ImageItem {
  id: string;
  src: string;
  alt: string;
  width: number | null;
  noteTitle: string;
  noteId: string;
}

interface ImagesGalleryProps {
  content: string; // Current note content to extract images from
  allNotes?: Array<{ id: string; title: string; content: string }>; // All notes for gallery
  onClose: () => void;
  onImageClick?: (src: string) => void;
}

export const ImagesGallery = ({ content, allNotes = [], onClose, onImageClick }: ImagesGalleryProps) => {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [selectedImage, setSelectedImage] = useState<ImageItem | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Extract images from all notes
    const extractedImages: ImageItem[] = [];
    
    // Helper to extract images from a note
    const extractFromNote = (noteContent: string, noteTitle: string, noteId: string) => {
      const imageRegex = /!\[([^\]]*)\]\((data:image\/[a-z]+;base64,[A-Za-z0-9+\/=]+)\)/g;
      let match;
      
      while ((match = imageRegex.exec(noteContent)) !== null) {
        const altText = match[1] || 'Image';
        const src = match[2];
        
        // Extract width if present
        let alt = altText;
        let width: number | null = null;
        const widthMatch = altText.match(/^(.*)\|(\d+)$/);
        if (widthMatch) {
          alt = widthMatch[1];
          width = parseInt(widthMatch[2], 10);
        }
        
        extractedImages.push({
          id: `${noteId}-${extractedImages.length}`,
          src,
          alt,
          width,
          noteTitle,
          noteId
        });
      }
    };
    
    // Extract from current note
    if (content) {
      extractFromNote(content, 'Current Note', 'current');
    }
    
    // Extract from all other notes
    allNotes.forEach(note => {
      if (note.content) {
        extractFromNote(note.content, note.title, note.id);
      }
    });
    
    setImages(extractedImages);
  }, [content, allNotes]);

  const handleCopyMarkdown = (image: ImageItem) => {
    const markdown = image.width 
      ? `![${image.alt}|${image.width}](${image.src})`
      : `![${image.alt}](${image.src})`;
    
    navigator.clipboard.writeText(markdown);
    toast({
      title: "Copied",
      description: "Image markdown copied to clipboard",
    });
  };

  const handleImageClick = (image: ImageItem) => {
    setSelectedImage(image);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-lg shadow-2xl w-full max-w-6xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Images Gallery</h2>
            <span className="text-sm text-muted-foreground">({images.length} images)</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Gallery Grid */}
        <ScrollArea className="flex-1 p-4">
          {images.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <ImageIcon className="w-16 h-16 mb-4 opacity-20" />
              <p>No images found in your notes</p>
              <p className="text-sm mt-2">Drag and drop images into the editor to add them</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
              {images.map((image) => (
                <div
                  key={image.id}
                  className="group relative aspect-square rounded-md overflow-hidden border border-border hover:border-primary transition-all cursor-pointer bg-muted/30 hover:scale-105 hover:shadow-lg"
                  onClick={() => handleImageClick(image)}
                >
                  <img
                    src={image.src}
                    alt={image.alt}
                    className="w-full h-full object-cover"
                  />
                  
                  {/* Overlay with actions */}
                  <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyMarkdown(image);
                      }}
                      className="gap-1 h-7 text-xs"
                    >
                      <Copy className="w-3 h-3" />
                      Copy
                    </Button>
                  </div>
                  
                  {/* Image info on hover */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-white text-[10px] truncate font-medium">{image.alt}</p>
                    <p className="text-white/60 text-[9px] truncate">{image.noteTitle}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Image Modal */}
        {selectedImage && (
          <div 
            className="fixed inset-0 bg-black/90 z-[60] overflow-auto"
            onClick={() => setSelectedImage(null)}
          >
            <div className="min-h-full flex items-start justify-center p-8">
              <div className="relative my-8">
                <img
                  src={selectedImage.src}
                  alt={selectedImage.alt}
                  className="w-auto h-auto max-w-none"
                  onClick={(e) => e.stopPropagation()}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  className="fixed top-4 right-4"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedImage(null);
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
                <div className="fixed bottom-4 left-4 right-4 bg-black/80 backdrop-blur-sm p-3 rounded-lg mx-auto max-w-2xl">
                  <p className="text-white font-medium">{selectedImage.alt}</p>
                  <p className="text-white/60 text-sm">From: {selectedImage.noteTitle}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
