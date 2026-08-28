/**
 * TypeScript types for AI Image Generation feature
 */

export type AspectRatio = "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9" | "21:9";

export interface GeneratedImageRequest {
  prompt: string;
  aspect_ratio?: AspectRatio;
  note_id?: string;
  tags?: string[];
  category?: string;
}

export interface GeneratedImageResponse {
  success: boolean;
  image_id: string;
  image_data: string; // Base64 string
  mime_type: string;
  aspect_ratio: AspectRatio;
  prompt: string;
}

export interface GeneratedImage {
  id: string;
  note_id?: string;
  prompt: string;
  image_data: string; // Base64 string
  thumbnail_data?: string; // Smaller base64 for gallery
  mime_type: string;
  aspect_ratio: AspectRatio;
  tags: string[];
  category?: string;
  is_favorite: boolean;
  display_order: number;
  generation_params: Record<string, any>;
  created_at: string;
  updated_at?: string;
}

export interface ImageCollection {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at?: string;
}

export interface ImageCollectionMembership {
  id: string;
  collection_id: string;
  image_id: string;
  added_at: string;
}

// Gallery-ready export format
export interface ImageExportData {
  id: string;
  prompt: string;
  image_data: string;
  aspect_ratio: AspectRatio;
  tags: string[];
  created_at: string;
  note_id?: string;
  collections: string[];
}

// API response types
export interface GetImageResponse {
  id: string;
  note_id?: string;
  prompt: string;
  image_data: string;
  mime_type: string;
  aspect_ratio: AspectRatio;
  tags: string[];
  category?: string;
  is_favorite: boolean;
  created_at: string;
}

export interface GetNoteImagesResponse {
  images: Array<{
    id: string;
    prompt: string;
    image_data: string;
    mime_type: string;
    aspect_ratio: AspectRatio;
    tags: string[];
    is_favorite: boolean;
    created_at: string;
  }>;
}

export interface DeleteImageResponse {
  success: boolean;
  message: string;
}

export interface UpdateFavoriteResponse {
  success: boolean;
  is_favorite: boolean;
}

export interface UpdateTagsResponse {
  success: boolean;
  tags: string[];
}
