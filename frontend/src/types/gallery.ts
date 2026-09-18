export interface GalleryCategory {
  id: string;
  name: string;
  description: string;
  displayOrder: number;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GalleryPhoto {
  id: string;
  categoryId: string;
  title: string;
  caption: string;
  altText: string;
  imageUrl: string;
  thumbnailUrl?: string;
  originalUrl?: string;
  width?: number;
  height?: number;
  fileSizeBytes?: number;
  displayOrder: number;
  published: boolean;
  uploadedAt: string;
  updatedAt: string;
  aspect?: 'landscape' | 'portrait' | 'square';
}

export interface GalleryFilters {
  categoryId: string | 'all';
  searchQuery?: string;
  onlyPublished?: boolean;
}

export type UploadStatus = 'queued' | 'uploading' | 'success' | 'error';

export interface PhotoUploadTask {
  id: string;
  file: File;
  name: string;
  sizeBytes: number;
  progress: number;
  status: UploadStatus;
  error: string | null;
  photo: GalleryPhoto | null;
  previewUrl: string | null;
}

export const DEFAULT_CATEGORY_ORDER = [
  'all',
  'jrf-events',
  'recognition-conclave-2025',
  'awards',
  'the-forum',
  'general-events',
] as const;

export type GalleryCategoryKey = (typeof DEFAULT_CATEGORY_ORDER)[number];
