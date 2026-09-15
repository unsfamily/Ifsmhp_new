/**
 * Publication types, owned by the publications module.
 *
 * `GET /members/me/publications` and `GET /admin/publications` are served by the
 * same serializer, so the row genuinely is one shape — it lives here rather than
 * in either consumer. `api/member.ts` and `api/admin.ts` both import from this
 * file and add only what is specific to their own view.
 */

/** Display labels produced by the API's `publicationStatusLabel` map. */
export type PublicationStatusLabel =
  | 'Draft' | 'Submitted' | 'Under Review'
  | 'Approved' | 'Rejected' | 'Published';

/** The raw enum values the transition endpoints expect, unlike the display labels. */
export type PublicationStatusValue =
  | 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW'
  | 'APPROVED' | 'REJECTED' | 'PUBLISHED';

export const PUBLICATION_STATUS_LABELS: PublicationStatusLabel[] = [
  'Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Published',
];

/** Mirrors the server's `PUBLICATION_CATEGORIES`, which the submission form enforces. */
export const PUBLICATION_CATEGORIES = [
  'Mental Health',
  'Scientific Research',
  'Product Reviews',
  'Service Analysis',
] as const;

/**
 * The publication state machine, mirroring the server's `allowed` map so the UI
 * only offers legal moves. Note there is no `Archived` state, and two moves with
 * no counterpart elsewhere: unpublishing a live paper back to Approved, and
 * resubmitting a rejected one.
 */
export const PUBLICATION_TRANSITIONS: Record<PublicationStatusLabel, PublicationStatusLabel[]> = {
  Draft: ['Submitted'],
  Submitted: ['Under Review', 'Approved', 'Rejected'],
  'Under Review': ['Approved', 'Rejected'],
  Approved: ['Published', 'Rejected'],
  Rejected: ['Submitted'],
  Published: ['Approved'],
};

export const statusValueOf: Record<PublicationStatusLabel, PublicationStatusValue> = {
  Draft: 'DRAFT',
  Submitted: 'SUBMITTED',
  'Under Review': 'UNDER_REVIEW',
  Approved: 'APPROVED',
  Rejected: 'REJECTED',
  Published: 'PUBLISHED',
};

/** Matches the server's `PUBLICATION_REJECTION_NOTE_MIN`; a shorter note is refused with 422. */
export const PUBLICATION_REJECTION_NOTE_MIN = 10;

export interface PublicationFile {
  /** The FileObject id — what the download route takes. */
  id: string;
  name: string;
  /** 'MANUSCRIPT' or 'SUPPLEMENTARY'. */
  kind: string;
  size: number;
}

/** One editorial decision, recorded against the manuscript. */
export interface PublicationDecision {
  decision: string;
  comment: string;
  at: string;
}

/** Every field the publication serializer returns, for either audience. */
export interface PublicationBase {
  id: string;
  title: string;
  category: string;
  researchType: string;
  status: PublicationStatusLabel;
  venue: string | null;
  doi: string | null;
  slug: string | null;
  abstract: string;
  views: number;
  downloads: number;
  submittedAt: string | null;
  publishedAt: string | null;
  /** Days waited since submission — drives the queue SLA colouring. */
  queueDays: number;
  /** Size of the first attachment, in bytes. */
  pdfSize: number;
  /** The author as the submission form captured them, free text. */
  authors: string | null;
  keywords: string | null;
  correspondingAuthor: string | null;
  correspondingEmail: string | null;
  /** Undefined when the caller did not ask for attachments; never empty-as-unknown. */
  files?: PublicationFile[];
}

/** The manuscript itself, as opposed to any supplementary material. */
export function manuscriptOf(publication: Pick<PublicationBase, 'files'>) {
  return publication.files?.find((file) => file.kind === 'MANUSCRIPT') ?? null;
}
