/**
 * Composites an image with a drawing overlay.
 * Used to merge pen tool markup with the original image before sending to AI.
 */

export async function compositeImageWithDrawing(
  imageSrc: string,      // Original image (base64 data URL or web URL)
  drawingData: string,   // Drawing overlay (base64 PNG data URL)
  targetWidth?: number,  // Optional: scale to this width
  targetHeight?: number  // Optional: scale to this height
): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Canvas 2D context not supported'));
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      // Use original image dimensions, or scale if specified
      const width = targetWidth || img.width;
      const height = targetHeight || img.height;
      
      canvas.width = width;
      canvas.height = height;
      
      // Draw original image (scaled to fit canvas)
      ctx.drawImage(img, 0, 0, width, height);
      
      // Draw markup overlay on top
      const overlay = new Image();
      overlay.onload = () => {
        // Scale overlay to match canvas dimensions
        ctx.drawImage(overlay, 0, 0, width, height);
        
        // Return as base64 data URL
        resolve(canvas.toDataURL('image/png'));
      };
      
      overlay.onerror = () => {
        reject(new Error('Failed to load drawing overlay'));
      };
      
      overlay.src = drawingData;
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load original image'));
    };
    
    img.src = imageSrc;
  });
}

/**
 * Checks if a drawing canvas has any actual content (non-transparent pixels)
 */
export function hasDrawingContent(drawingData: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!drawingData) {
      resolve(false);
      return;
    }
    
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(false);
        return;
      }
      
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      // Check alpha channel for any non-transparent pixels
      const hasContent = imageData.data.some((value, index) => 
        index % 4 === 3 && value > 0
      );
      
      resolve(hasContent);
    };
    
    img.onerror = () => resolve(false);
    img.src = drawingData;
  });
}
