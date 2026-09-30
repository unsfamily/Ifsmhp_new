export interface GalleryCategory {
  id: string;
  photoCount: number;
  name: string;
  description: string;
  displayOrder: number;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GallerySubcategory {
  id: string;
  categoryId: string;
  name: string;
  photoCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface GalleryPhoto {
  id: string;
  categoryId: string;
  subcategoryId: string | null;
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
  subcategoryId?: string;
  searchQuery?: string;
  onlyPublished?: boolean;
}

export type UploadStatus = 'queued' | 'uploading' | 'success' | 'error';

export interface PhotoUploadTask {
  categoryId: string;
  subcategoryId: string | null;
  id: string;
  file: File;
  name: string;
  title: string;
  caption: string;
  sizeBytes: number;
  progress: number;
  status: UploadStatus;
  error: string | null;
  photo: GalleryPhoto | null;
  previewUrl: string | null;
}
