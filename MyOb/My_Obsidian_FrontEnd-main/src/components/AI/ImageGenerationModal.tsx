import { useState } from "react";
import { Loader2, Sparkles, Image as ImageIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { generateImage } from "@/lib/image-api";
import type { AspectRatio } from "@/types/image-generation";

interface ImageGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  noteId?: string;
  onImageGenerated?: (imageData: string, mimeType: string, prompt: string, aspectRatio: string) => void;
}

const ASPECT_RATIOS: { value: AspectRatio; label: string; description: string }[] = [
  { value: "1:1", label: "1:1", description: "1024×1024 (Square)" },
  { value: "16:9", label: "16:9", description: "1344×768 (Widescreen)" },
  { value: "9:16", label: "9:16", description: "768×1344 (Portrait)" },
  { value: "4:3", label: "4:3", description: "1184×864 (Standard)" },
  { value: "3:4", label: "3:4", description: "864×1184 (Portrait)" },
  { value: "21:9", label: "21:9", description: "1536×672 (Ultra-wide)" },
  { value: "3:2", label: "3:2", description: "1248×832" },
  { value: "2:3", label: "2:3", description: "832×1248" },
  { value: "5:4", label: "5:4", description: "1152×896" },
  { value: "4:5", label: "4:5", description: "896×1152" },
];

export const ImageGenerationModal = ({
  isOpen,
  onClose,
  noteId,
  onImageGenerated,
}: ImageGenerationModalProps) => {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<{
    data: string;
    mimeType: string;
    prompt: string;
    aspectRatio: string;
  } | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Prompt required",
        description: "Please enter a description for the image",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      const result = await generateImage(prompt, aspectRatio, noteId);
      
      const imageData = {
        data: result.image_data,
        mimeType: result.mime_type,
        prompt: result.prompt,
        aspectRatio: result.aspect_ratio,
      };

      setGeneratedImage(imageData);

      toast({
        title: "Image generated!",
        description: "Your AI-generated image is ready",
      });

      // Notify parent component if callback provided
      if (onImageGenerated) {
        onImageGenerated(
          imageData.data,
          imageData.mimeType,
          imageData.prompt,
          imageData.aspectRatio
        );
      }
    } catch (error) {
      console.error("Failed to generate image:", error);
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Could not generate image",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClose = () => {
    setPrompt("");
    setGeneratedImage(null);
    onClose();
  };

  const handleNewImage = () => {
    setPrompt("");
    setGeneratedImage(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Generate AI Image
          </DialogTitle>
          <DialogDescription>
            Create images using Gemini 2.5 Flash Image
          </DialogDescription>
        </DialogHeader>

        {!generatedImage ? (
          <div className="space-y-4 py-4">
            {/* Prompt input */}
            <div className="space-y-2">
              <Label htmlFor="prompt">
                Image Description
              </Label>
              <Textarea
                id="prompt"
                placeholder="Describe the image you want to generate... (e.g., 'A nano banana wearing sunglasses in a fancy restaurant')"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                disabled={isGenerating}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Be specific and descriptive for best results
              </p>
            </div>

            {/* Aspect ratio selector */}
            <div className="space-y-2">
              <Label htmlFor="aspect-ratio">Aspect Ratio</Label>
              <Select
                value={aspectRatio}
                onValueChange={(value) => setAspectRatio(value as AspectRatio)}
                disabled={isGenerating}
              >
                <SelectTrigger id="aspect-ratio">
                  <SelectValue placeholder="Select aspect ratio" />
                </SelectTrigger>
                <SelectContent>
                  {ASPECT_RATIOS.map((ratio) => (
                    <SelectItem key={ratio.value} value={ratio.value}>
                      {ratio.label} — {ratio.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Generate button */}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={handleClose} disabled={isGenerating}>
                Cancel
              </Button>
              <Button onClick={handleGenerate} disabled={isGenerating || !prompt.trim()}>
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-4 h-4 mr-2" />
                    Generate Image
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Show generated image preview */}
            <div className="rounded-lg overflow-hidden border">
              <img
                src={`data:${generatedImage.mimeType};base64,${generatedImage.data}`}
                alt={generatedImage.prompt}
                className="w-full h-auto"
              />
            </div>

            <div className="text-sm text-muted-foreground">
              <p className="font-medium">Prompt:</p>
              <p className="mt-1">{generatedImage.prompt}</p>
              <p className="mt-2">
                <span className="font-medium">Aspect Ratio:</span> {generatedImage.aspectRatio}
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleNewImage}>
                Generate Another
              </Button>
              <Button onClick={handleClose}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
