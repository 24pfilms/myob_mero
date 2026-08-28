import type { AspectRatio } from "@/types/image-generation";

const API_BASE = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8001/api").replace(/\/$/, "");
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export interface GeneratedImageResponse {
  success: boolean;
  image_id: string;
  image_data: string;
  mime_type: string;
  aspect_ratio: string;
  prompt: string;
}

function safeMimeType(mimeType: string) {
  if (!IMAGE_TYPES.has(mimeType)) throw new Error(`Unsupported image type: ${mimeType}`);
  return mimeType;
}

export async function generateImage(
  prompt: string,
  aspectRatio: AspectRatio,
  noteId?: string,
): Promise<GeneratedImageResponse> {
  const response = await fetch(`${API_BASE}/ai/generate-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, aspect_ratio: aspectRatio, note_id: noteId }),
  });

  if (!response.ok) {
    let message = `Image generation failed (${response.status})`;
    try {
      const error = await response.json();
      if (typeof error?.detail === "string") message = error.detail;
    } catch {
      // Keep the status-based message for non-JSON failures.
    }
    throw new Error(message);
  }

  const result = (await response.json()) as GeneratedImageResponse;
  safeMimeType(result.mime_type);
  return result;
}

export function base64ToDataUrl(imageData: string, mimeType: string) {
  return `data:${safeMimeType(mimeType)};base64,${imageData}`;
}

export function downloadImageFromBase64(imageData: string, mimeType: string, filename: string) {
  const link = document.createElement("a");
  link.href = base64ToDataUrl(imageData, mimeType);
  link.download = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  link.click();
}
