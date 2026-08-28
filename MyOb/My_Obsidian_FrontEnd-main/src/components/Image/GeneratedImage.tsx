import { useState } from "react";
import { Download, Maximize2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FullscreenImageViewer } from "./FullscreenImageViewer";
import { base64ToDataUrl, downloadImageFromBase64 } from "@/lib/image-api";

interface GeneratedImageProps {
  imageData: string; // Base64 string
  mimeType: string;
  prompt?: string;
  aspectRatio?: string;
  className?: string;
}

export const GeneratedImage = ({
  imageData,
  mimeType,
  prompt,
  aspectRatio,
  className = "",
}: GeneratedImageProps) => {
  const { toast } = useToast();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const imageUrl = base64ToDataUrl(imageData, mimeType);

  const handleDownload = () => {
    try {
      const filename = `myob-generated-${Date.now()}.png`;
      downloadImageFromBase64(imageData, mimeType, filename);
      
      toast({
        title: "Image downloaded",
        description: `Saved as ${filename}`,
      });
    } catch (error) {
      console.error("Failed to download image:", error);
      toast({
        title: "Download failed",
        description: "Could not download the image",
        variant: "destructive",
      });
    }
  };

  const handleFullscreen = () => {
    setIsFullscreen(true);
  };

  if (imageError) {
    return (
      <div className={`flex items-center justify-center p-8 bg-muted rounded-lg ${className}`}>
        <p className="text-muted-foreground">Failed to load image</p>
      </div>
    );
  }

  return (
    <>
      <div
        className={`relative group rounded-lg overflow-hidden bg-muted ${className}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Loading state */}
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Image */}
        <img
          src={imageUrl}
          alt={prompt || "AI Generated Image"}
          className={`w-full h-auto object-contain transition-opacity duration-300 ${
            imageLoaded ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setImageLoaded(true)}
          onError={() => {
            setImageError(true);
            setImageLoaded(true);
          }}
        />

        {/* Hover controls overlay */}
        {imageLoaded && (
          <div
            className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${
              isHovered ? "opacity-100" : "opacity-0"
            }`}
          >
            {/* Download button - top-left */}
            <Button
              variant="secondary"
              size="icon"
              className="absolute top-2 left-2 bg-white/90 hover:bg-white shadow-lg"
              onClick={handleDownload}
              title="Download image"
            >
              <Download className="w-4 h-4" />
            </Button>

            {/* Fullscreen button - top-right */}
            <Button
              variant="secondary"
              size="icon"
              className="absolute top-2 right-2 bg-white/90 hover:bg-white shadow-lg"
              onClick={handleFullscreen}
              title="View fullscreen"
            >
              <Maximize2 className="w-4 h-4" />
            </Button>

            {/* Optional: Show prompt on hover */}
            {prompt && (
              <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                <p className="text-white text-sm line-clamp-2">{prompt}</p>
                {aspectRatio && (
                  <p className="text-white/70 text-xs mt-1">
                    Aspect ratio: {aspectRatio}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fullscreen viewer */}
      <FullscreenImageViewer
        imageUrl={imageUrl}
        alt={prompt || "AI Generated Image"}
        isOpen={isFullscreen}
        onClose={() => setIsFullscreen(false)}
      />
    </>
  );
};
