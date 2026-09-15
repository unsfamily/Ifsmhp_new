import { apiClient } from './client';

interface Envelope<T> {
  success: true;
  data: T;
}

export interface Paginated<T> {
  items: T[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

/** One card on the public research listing. */
export interface PublicPublication {
  /** The slug when the paper has one, else its id — either resolves at /research/:id. */
  id: string;
  slug: string | null;
  title: string;
  author: string;
  memberId: string;
  date: string;
  category: string;
  researchType: string;
  abstract: string;
  views: number;
  downloads: number;
  doi: string | null;
  featured?: boolean;
  /** Whether a manuscript can be downloaded, without loading the attachments. */
  hasManuscript: boolean;
}

export interface PublicPublicationFile {
  kind: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
  /** Set only for the manuscript; supplementary material has no public route. */
  url: string | null;
}

/** A single paper, with everything needed to actually read it. */
export interface PublicPublicationDetail extends Omit<PublicPublication, 'hasManuscript' | 'featured'> {
  fullText: string | null;
  files: PublicPublicationFile[];
}

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';

/**
 * Absolute URL of a published paper's manuscript.
 *
 * Deliberately a plain URL rather than an `apiClient` blob fetch: this route is
 * the one place in the API that serves bytes without a token, so it can be an
 * `href` that works for a signed-out reader.
 */
export function publicationFileUrl(slugOrId: string, options: { inline?: boolean } = {}) {
  const query = options.inline ? '?inline=1' : '';
  return `${baseURL}/public/publications/${encodeURIComponent(slugOrId)}/file${query}`;
}

/** Resolves a DOI to its canonical landing page. */
export function doiUrl(doi: string) {
  return `https://doi.org/${doi.replace(/^https?:\/\/doi\.org\//i, '')}`;
}

export const publicApi = {
  stats: async () => (await apiClient.get<Envelope<unknown>>('/public/stats')).data.data,
  publications: async (params?: Record<string, unknown>) =>
    (await apiClient.get<Envelope<Paginated<PublicPublication>>>('/public/publications', { params })).data.data,
  /** The detail route nests its payload one level deeper than the listing. */
  publication: async (id: string) =>
    (await apiClient.get<Envelope<{ publication: PublicPublicationDetail }>>(`/public/publications/${id}`)).data.data.publication,
  productReviews: async (params?: Record<string, unknown>) => (await apiClient.get<Envelope<unknown>>('/public/product-reviews', { params })).data.data,
  events: async (params?: Record<string, unknown>) => (await apiClient.get<Envelope<unknown>>('/public/events', { params })).data.data,
  event: async (id: string) => (await apiClient.get<Envelope<unknown>>(`/public/events/${id}`)).data.data,
  gallery: async (params?: Record<string, unknown>) => (await apiClient.get<Envelope<unknown>>('/public/gallery', { params })).data.data,
  contact: async (payload: unknown) => (await apiClient.post<Envelope<unknown>>('/contact', payload)).data.data,
};
