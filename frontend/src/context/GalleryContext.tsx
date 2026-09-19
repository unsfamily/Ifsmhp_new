import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  GalleryCategory,
  GalleryFilters,
  GalleryPhoto,
  PhotoUploadTask,
} from '../types/gallery';

const STORAGE_KEY = 'ifsmhp.gallery.v1';
export const MAX_UPLOAD_SIZE_BYTES = 100 * 1024 * 1024;
export const ACCEPTED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];
export const ACCEPTED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];

const IMG_PROMPT = (subject: string) =>
  encodeURIComponent(
    `Professional institutional photograph, IFSMHP academic conference scene, ${subject}, well-lit hall with attendees in smart business attire, mixed group candid and posed composition, branded banners in background, shallow depth of field, photorealistic, high detail, editorial documentary style, warm neutral tones, all persons are generically detailed adults with no recognisable individuals`
  );
const IMG = (
  subject: string,
  size: 'landscape_16_9' | 'portrait_4_3' | 'square' = 'landscape_16_9'
) =>
  `https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=${IMG_PROMPT(
    subject
  )}&image_size=${size}`;

const ISO_NOW = () => new Date().toISOString();

function uid(prefix = 'gal'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

const DEFAULT_CATEGORIES: GalleryCategory[] = [
  {
    id: 'jrf-events',
    name: 'Junior Research Fellowship Events',
    description:
      'Workshops, induction ceremonies, and research showcases featuring junior research fellows across the IFSMHP network.',
    displayOrder: 1,
    published: true,
    createdAt: '2025-08-12T09:00:00.000Z',
    updatedAt: '2025-08-12T09:00:00.000Z',
  },
  {
    id: 'recognition-conclave-2025',
    name: 'Recognition Conclave 2025',
    description:
      'Highlights from the 2025 Recognition Conclave celebrating distinguished contributions to research methodology, mental health policy, and interdisciplinary collaboration.',
    displayOrder: 2,
    published: true,
    createdAt: '2025-09-18T10:30:00.000Z',
    updatedAt: '2025-09-18T10:30:00.000Z',
  },
  {
    id: 'awards',
    name: 'Awards',
    description:
      'Awards ceremonies, medal presentations, citations, and Hall of Fame portraits across the annual IFSMHP honours programme.',
    displayOrder: 3,
    published: true,
    createdAt: '2025-07-22T14:15:00.000Z',
    updatedAt: '2025-07-22T14:15:00.000Z',
  },
  {
    id: 'the-forum',
    name: 'The Forum',
    description:
      'General assembly meetings, council sessions, steering committee gatherings, and plenary proceedings of the International Forum.',
    displayOrder: 4,
    published: true,
    createdAt: '2025-06-04T08:45:00.000Z',
    updatedAt: '2025-06-04T08:45:00.000Z',
  },
  {
    id: 'general-events',
    name: 'General Events',
    description:
      'Community mixers, outreach activities, lab open houses, member welcome days, and other public engagements hosted by IFSMHP.',
    displayOrder: 5,
    published: true,
    createdAt: '2025-05-30T16:20:00.000Z',
    updatedAt: '2025-05-30T16:20:00.000Z',
  },
];

const SAMPLE_PHOTOS: GalleryPhoto[] = [
  {
    id: 'photo-jrf-01',
    categoryId: 'jrf-events',
    title: 'JRF Induction — Welcome Address',
    caption:
      'Programme Director opens the 2025 Junior Research Fellowship induction week to the incoming cohort of research scholars.',
    altText:
      'Lectern welcome address to a seated auditorium of early-career researchers during JRF induction week',
    imageUrl: IMG('Induction ceremony, formal welcome address at lectern, scholars seated in modern auditorium'),
    displayOrder: 1,
    published: true,
    uploadedAt: '2025-08-13T10:00:00.000Z',
    updatedAt: '2025-08-13T10:00:00.000Z',
    aspect: 'landscape',
  },
  {
    id: 'photo-jrf-02',
    categoryId: 'jrf-events',
    title: 'JRF Poster Walk — Track B',
    caption:
      'Junior fellows present their pilot study posters during the afternoon walk-around with faculty mentors.',
    altText:
      'Early career researchers discussing academic posters in a brightly lit exhibition space',
    imageUrl: IMG('Academic poster session with junior researchers and faculty mentors standing by poster boards'),
    displayOrder: 2,
    published: true,
    uploadedAt: '2025-08-14T15:10:00.000Z',
    updatedAt: '2025-08-14T15:10:00.000Z',
    aspect: 'landscape',
  },
  {
    id: 'photo-jrf-03',
    categoryId: 'jrf-events',
    title: 'JRF Roundtable — Methodological Workshop',
    caption:
      'Hands-on workshop on mixed-methods research design with a small-group breakout roundtable.',
    altText:
      'Roundtable workshop participants in a circle of tables working on research design documents',
    imageUrl: IMG('Roundtable methodological workshop, mixed-methods research, small group collaboration'),
    displayOrder: 3,
    published: true,
    uploadedAt: '2025-08-15T11:30:00.000Z',
    updatedAt: '2025-08-15T11:30:00.000Z',
    aspect: 'square',
  },
  {
    id: 'photo-conclave-01',
    categoryId: 'recognition-conclave-2025',
    title: 'Recognition Conclave — Plenary Stage',
    caption:
      'The 2025 Recognition Conclave plenary session opens with the keynote from the CRO, honouring 42 distinguished contributors.',
    altText:
      'Conference plenary stage, Recognition Conclave 2025 branding, audience of academics',
    imageUrl: IMG('Recognition Conclave 2025 plenary stage, keynote session, large conference auditorium'),
    displayOrder: 1,
    published: true,
    uploadedAt: '2025-09-18T11:00:00.000Z',
    updatedAt: '2025-09-18T11:00:00.000Z',
    aspect: 'landscape',
  },
  {
    id: 'photo-conclave-02',
    categoryId: 'recognition-conclave-2025',
    title: 'Conclave — Distinguished Citation Reading',
    caption:
      'Citation for the Lifetime Contribution to Mental Health Science award is read aloud during the evening ceremony.',
    altText:
      'Formal citation reading ceremony on a candlelit stage, Recognition Conclave 2025',
    imageUrl: IMG('Formal citation reading ceremony on stage, Recognition Conclave 2025, candlelit banquet hall'),
    displayOrder: 2,
    published: true,
    uploadedAt: '2025-09-18T20:45:00.000Z',
    updatedAt: '2025-09-18T20:45:00.000Z',
    aspect: 'portrait',
  },
  {
    id: 'photo-conclave-03',
    categoryId: 'recognition-conclave-2025',
    title: 'Conclave — Riverside Networking Reception',
    caption:
      'Delegates networking over canapés at the Thursday evening riverside reception hosted by the IFSMHP Secretariat.',
    altText:
      'Rooftop riverside reception, delegates in business attire networking over canapes, dusk lighting',
    imageUrl: IMG('Riverside networking reception, delegates at dusk, canapes, waterfront terrace'),
    displayOrder: 3,
    published: true,
    uploadedAt: '2025-09-19T19:30:00.000Z',
    updatedAt: '2025-09-19T19:30:00.000Z',
    aspect: 'landscape',
  },
  {
    id: 'photo-awards-01',
    categoryId: 'awards',
    title: 'CRO Lifetime Achievement Medallion',
    caption:
      'Close-up of the 2025 Lifetime Achievement Medallion being presented during the black-tie Awards Night ceremony.',
    altText:
      'Hand placing gold medallion over a black-tie award recipient, formal ceremony stage',
    imageUrl: IMG('Formal awards medallion presentation, black-tie ceremony stage, hand placing gold medallion', 'portrait_4_3'),
    displayOrder: 1,
    published: true,
    uploadedAt: '2025-11-22T21:10:00.000Z',
    updatedAt: '2025-11-22T21:10:00.000Z',
    aspect: 'portrait',
  },
  {
    id: 'photo-awards-02',
    categoryId: 'awards',
    title: 'Awards Night — Group Photo of Honourees',
    caption:
      'The 2025 IFSMHP honourees on stage following the presentation of all nine awards.',
    altText:
      'Group of nine award recipients standing on formal stage with certificates and medals',
    imageUrl: IMG('Awards night group photograph, nine honourees on stage, formal ceremony'),
    displayOrder: 2,
    published: true,
    uploadedAt: '2025-11-22T22:40:00.000Z',
    updatedAt: '2025-11-22T22:40:00.000Z',
    aspect: 'landscape',
  },
  {
    id: 'photo-awards-03',
    categoryId: 'awards',
    title: 'Early Career Researcher Award',
    caption:
      'Early Career Researcher Citations are awarded to four emerging scholars in clinical and quantitative mental health.',
    altText:
      'Four early career researchers holding framed citation certificates on stage',
    imageUrl: IMG('Early career researchers with framed citation certificates, awards ceremony stage', 'square'),
    displayOrder: 3,
    published: true,
    uploadedAt: '2025-11-22T21:55:00.000Z',
    updatedAt: '2025-11-22T21:55:00.000Z',
    aspect: 'square',
  },
  {
    id: 'photo-forum-01',
    categoryId: 'the-forum',
    title: 'General Assembly — Floor Vote',
    caption:
      'Delegates participate in a standing floor vote on the 2026 workplan during the annual General Assembly.',
    altText:
      'Forum delegates standing during a floor vote in a formal assembly chamber',
    imageUrl: IMG('General assembly floor vote, delegates standing in formal assembly chamber'),
    displayOrder: 1,
    published: true,
    uploadedAt: '2025-10-11T14:00:00.000Z',
    updatedAt: '2025-10-11T14:00:00.000Z',
    aspect: 'landscape',
  },
  {
    id: 'photo-forum-02',
    categoryId: 'the-forum',
    title: 'Steering Committee Working Lunch',
    caption:
      'Steering committee deliberating the three-year research infrastructure strategy during a closed working lunch.',
    altText:
      'Steering committee members around a wooden boardroom table, notebooks and whiteboard',
    imageUrl: IMG('Steering committee boardroom lunch working session, strategy whiteboard, oak table'),
    displayOrder: 2,
    published: true,
    uploadedAt: '2025-10-12T12:30:00.000Z',
    updatedAt: '2025-10-12T12:30:00.000Z',
    aspect: 'landscape',
  },
  {
    id: 'photo-general-01',
    categoryId: 'general-events',
    title: 'New Member Welcome Day — Grand Staircase',
    caption:
      'The February 2026 new member cohort gathers on the Grand Staircase for the official induction group photograph.',
    altText:
      'Group photo on grand stone staircase, new members in business attire with welcome programmes',
    imageUrl: IMG('Grand staircase group photograph, new member induction day, academic institution entrance hall'),
    displayOrder: 1,
    published: true,
    uploadedAt: '2026-02-05T12:45:00.000Z',
    updatedAt: '2026-02-05T12:45:00.000Z',
    aspect: 'landscape',
  },
  {
    id: 'photo-general-02',
    categoryId: 'general-events',
    title: 'Lab Open House — Demonstration Table',
    caption:
      'Research staff demonstrate shared-instrument workflows to local school students and industry partners during the annual Lab Open House.',
    altText:
      'Lab open house demonstration table with scientific instruments and colourful glassware',
    imageUrl: IMG('Laboratory open house demonstration table with glassware, family-friendly science tour', 'square'),
    displayOrder: 2,
    published: true,
    uploadedAt: '2026-04-17T14:10:00.000Z',
    updatedAt: '2026-04-17T14:10:00.000Z',
    aspect: 'square',
  },
  {
    id: 'photo-general-03',
    categoryId: 'general-events',
    title: 'Community Mixer — Welcome Desk',
    caption:
      'Volunteers at the community mixer welcome desk assisting with name badges, campus maps, and membership programmes.',
    altText:
      'Volunteer welcome desk with name badges, flyers, and members being checked in',
    imageUrl: IMG('Community mixer volunteer welcome desk assisting attendees with badges and programmes'),
    displayOrder: 3,
    published: true,
    uploadedAt: '2026-03-02T09:15:00.000Z',
    updatedAt: '2026-03-02T09:15:00.000Z',
    aspect: 'landscape',
  },
];

interface PersistedState {
  categories: GalleryCategory[];
  photos: GalleryPhoto[];
}

interface GalleryStoreValue {
  categories: GalleryCategory[];
  photos: GalleryPhoto[];
  createCategory: (
    input: Pick<GalleryCategory, 'name' | 'description'> &
      Partial<Pick<GalleryCategory, 'displayOrder' | 'published'>>
  ) => GalleryCategory;
  updateCategory: (
    id: string,
    patch: Partial<Omit<GalleryCategory, 'id' | 'createdAt'>>
  ) => void;
  deleteCategory: (id: string) => void;
  toggleCategoryPublished: (id: string) => void;
  reorderCategory: (id: string, direction: -1 | 1) => void;
  addPhoto: (
    input: Pick<
      GalleryPhoto,
      'categoryId' | 'title' | 'caption' | 'altText' | 'imageUrl'
    > &
      Partial<Pick<GalleryPhoto, 'displayOrder' | 'published' | 'aspect'>>
  ) => GalleryPhoto;
  updatePhoto: (
    id: string,
    patch: Partial<Omit<GalleryPhoto, 'id' | 'uploadedAt'>>
  ) => void;
  deletePhoto: (id: string) => void;
  togglePhotoPublished: (id: string) => void;
  movePhoto: (photoId: string, targetCategoryId: string) => void;
  reorderPhoto: (photoId: string, direction: -1 | 1) => void;
  getCategoryPhotos: (
    categoryId: string,
    options?: { onlyPublished?: boolean }
  ) => GalleryPhoto[];
  applyFilters: (filters: GalleryFilters) => {
    groupedByCategory: Array<{
      category: GalleryCategory;
      photos: GalleryPhoto[];
    }>;
    flatPhotos: GalleryPhoto[];
  };
  simulateUpload: (file: File) => Promise<PhotoUploadTask>;
  validateFile: (file: File) =>
    | { ok: true }
    | {
        ok: false;
        reason: 'type' | 'size';
        message: string;
      };
  resetStore: () => void;
}

const GalleryContext = createContext<GalleryStoreValue | null>(null);

function loadInitialState(): PersistedState {
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedState;
        if (parsed && Array.isArray(parsed.categories) && Array.isArray(parsed.photos)) {
          return parsed;
        }
      }
    } catch {
      // ignore corrupted storage
    }
  }
  return {
    categories: DEFAULT_CATEGORIES.slice(),
    photos: SAMPLE_PHOTOS.slice(),
  };
}

export function GalleryProvider({ children }: { children: ReactNode }) {
  const initial = useMemo<PersistedState>(() => loadInitialState(), []);
  const [categories, setCategories] = useState<GalleryCategory[]>(initial.categories);
  const [photos, setPhotos] = useState<GalleryPhoto[]>(initial.photos);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ categories, photos } satisfies PersistedState)
      );
    } catch {
      // ignore quota errors
    }
  }, [categories, photos]);

  const createCategory = useCallback<GalleryStoreValue['createCategory']>(
    (input) => {
      const now = ISO_NOW();
      const nextOrder =
        typeof input.displayOrder === 'number'
          ? input.displayOrder
          : Math.max(0, ...categories.map((c) => c.displayOrder)) + 1;
      const cat: GalleryCategory = {
        id: uid('cat'),
        name: input.name.trim(),
        description: input.description.trim(),
        displayOrder: nextOrder,
        published: input.published ?? true,
        createdAt: now,
        updatedAt: now,
      };
      setCategories((prev) =>
        [...prev, cat].sort((a, b) => a.displayOrder - b.displayOrder)
      );
      return cat;
    },
    [categories]
  );

  const updateCategory = useCallback<GalleryStoreValue['updateCategory']>(
    (id, patch) => {
      setCategories((prev) =>
        prev
          .map((c) => (c.id === id ? { ...c, ...patch, updatedAt: ISO_NOW() } : c))
          .sort((a, b) => a.displayOrder - b.displayOrder)
      );
    },
    []
  );

  const deleteCategory = useCallback<GalleryStoreValue['deleteCategory']>((id) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
    setPhotos((prev) => prev.filter((p) => p.categoryId !== id));
  }, []);

  const toggleCategoryPublished = useCallback<
    GalleryStoreValue['toggleCategoryPublished']
  >((id) => {
    setCategories((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, published: !c.published, updatedAt: ISO_NOW() } : c
      )
    );
  }, []);

  const reorderCategory = useCallback<GalleryStoreValue['reorderCategory']>(
    (id, direction) => {
      setCategories((prev) => {
        const sorted = [...prev].sort((a, b) => a.displayOrder - b.displayOrder);
        const idx = sorted.findIndex((c) => c.id === id);
        if (idx < 0) return prev;
        const targetIdx = idx + direction;
        if (targetIdx < 0 || targetIdx >= sorted.length) return prev;
        const a = sorted[idx]!;
        const b = sorted[targetIdx]!;
        const aOrder = a.displayOrder;
        const bOrder = b.displayOrder;
        return sorted
          .map((c) => {
            if (c.id === a.id) return { ...c, displayOrder: bOrder, updatedAt: ISO_NOW() };
            if (c.id === b.id) return { ...c, displayOrder: aOrder, updatedAt: ISO_NOW() };
            return c;
          })
          .sort((x, y) => x.displayOrder - y.displayOrder);
      });
    },
    []
  );

  const addPhoto = useCallback<GalleryStoreValue['addPhoto']>((input) => {
    const now = ISO_NOW();
    return new Promise<GalleryPhoto>((resolve) => {
      setPhotos((prev) => {
        const siblings = prev.filter((p) => p.categoryId === input.categoryId);
        const nextOrder =
          typeof input.displayOrder === 'number'
            ? input.displayOrder
            : Math.max(0, ...siblings.map((p) => p.displayOrder), 0) + 1;
        const photo: GalleryPhoto = {
          id: uid('p'),
          categoryId: input.categoryId,
          title: input.title.trim(),
          caption: input.caption.trim(),
          altText: input.altText.trim(),
          imageUrl: input.imageUrl,
          displayOrder: nextOrder,
          published: input.published ?? true,
          uploadedAt: now,
          updatedAt: now,
          aspect: input.aspect ?? 'landscape',
        };
        queueMicrotask(() => resolve(photo));
        return [...prev, photo];
      });
    }) as unknown as GalleryPhoto;
  }, []);

  const updatePhoto = useCallback<GalleryStoreValue['updatePhoto']>((id, patch) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: ISO_NOW() } : p))
    );
  }, []);

  const deletePhoto = useCallback<GalleryStoreValue['deletePhoto']>((id) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const togglePhotoPublished = useCallback<GalleryStoreValue['togglePhotoPublished']>(
    (id) => {
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, published: !p.published, updatedAt: ISO_NOW() } : p
        )
      );
    },
    []
  );

  const movePhoto = useCallback<GalleryStoreValue['movePhoto']>(
    (photoId, targetCategoryId) => {
      setPhotos((prev) => {
        const siblings = prev.filter((p) => p.categoryId === targetCategoryId);
        const nextOrder = Math.max(0, ...siblings.map((p) => p.displayOrder), 0) + 1;
        return prev.map((p) =>
          p.id === photoId
            ? {
                ...p,
                categoryId: targetCategoryId,
                displayOrder: nextOrder,
                updatedAt: ISO_NOW(),
              }
            : p
        );
      });
    },
    []
  );

  const reorderPhoto = useCallback<GalleryStoreValue['reorderPhoto']>(
    (photoId, direction) => {
      setPhotos((prev) => {
        const photo = prev.find((p) => p.id === photoId);
        if (!photo) return prev;
        const siblings = prev
          .filter((p) => p.categoryId === photo.categoryId)
          .sort((a, b) => a.displayOrder - b.displayOrder);
        const idx = siblings.findIndex((p) => p.id === photoId);
        if (idx < 0) return prev;
        const targetIdx = idx + direction;
        if (targetIdx < 0 || targetIdx >= siblings.length) return prev;
        const a = siblings[idx]!;
        const b = siblings[targetIdx]!;
        const aOrder = a.displayOrder;
        const bOrder = b.displayOrder;
        return prev.map((p) => {
          if (p.id === a.id)
            return { ...p, displayOrder: bOrder, updatedAt: ISO_NOW() };
          if (p.id === b.id)
            return { ...p, displayOrder: aOrder, updatedAt: ISO_NOW() };
          return p;
        });
      });
    },
    []
  );

  const getCategoryPhotos = useCallback<GalleryStoreValue['getCategoryPhotos']>(
    (categoryId, options) => {
      const onlyPublished = options?.onlyPublished ?? false;
      return photos
        .filter((p) => p.categoryId === categoryId)
        .filter((p) => (onlyPublished ? p.published : true))
        .sort((a, b) => a.displayOrder - b.displayOrder);
    },
    [photos]
  );

  const applyFilters = useCallback<GalleryStoreValue['applyFilters']>(
    (filters) => {
      const onlyPublished = filters.onlyPublished ?? true;
      const sortedCategories = [...categories].sort((a, b) => a.displayOrder - b.displayOrder);
      const q = (filters.searchQuery ?? '').trim().toLowerCase();

      const visibleCategories = sortedCategories.filter((c) =>
        onlyPublished ? c.published : true
      );
      const grouped = visibleCategories.map((cat) => {
        let catPhotos = photos
          .filter((p) => p.categoryId === cat.id)
          .filter((p) => (onlyPublished ? p.published : true))
          .sort((a, b) => a.displayOrder - b.displayOrder);
        if (q) {
          catPhotos = catPhotos.filter(
            (p) =>
              p.title.toLowerCase().includes(q) ||
              p.caption.toLowerCase().includes(q) ||
              p.altText.toLowerCase().includes(q)
          );
        }
        return { category: cat, photos: catPhotos };
      });

      if (filters.categoryId === 'all') {
        const flat = grouped.flatMap((g) => g.photos);
        return {
          groupedByCategory: grouped.filter((g) => g.photos.length > 0),
          flatPhotos: flat,
        };
      }
      const single = grouped.find((g) => g.category.id === filters.categoryId);
      return {
        groupedByCategory: single && single.photos.length > 0 ? [single] : [],
        flatPhotos: single?.photos ?? [],
      };
    },
    [categories, photos]
  );

  const validateFile: GalleryStoreValue['validateFile'] = (file) => {
    const mimeTypeOk = ACCEPTED_MIME_TYPES.includes(file.type);
    const extOk =
      mimeTypeOk ||
      ACCEPTED_EXTENSIONS.some((ext) =>
        file.name.toLowerCase().endsWith(`.${ext}`)
      );
    if (!mimeTypeOk && !extOk) {
      const list = ACCEPTED_EXTENSIONS.map((e) => e.toUpperCase()).join(', ');
      return {
        ok: false,
        reason: 'type',
        message: `Unsupported file type "${file.type || file.name.split('.').pop() || 'unknown'}". Accepted formats: ${list}.`,
      };
    }
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      return {
        ok: false,
        reason: 'size',
        message: `File "${file.name}" exceeds the 100 MB limit (${(
          file.size /
          1024 /
          1024
        ).toFixed(1)} MB).`,
      };
    }
    return { ok: true };
  };

  const simulateUpload = useCallback<GalleryStoreValue['simulateUpload']>(
    (file) =>
      new Promise((resolve) => {
        const validation = validateFile(file);
        const taskId = uid('upl');
        if (!validation.ok) {
          resolve({
            id: taskId,
            file,
            name: file.name,
            sizeBytes: file.size,
            progress: 0,
            status: 'error',
            error: validation.message,
            photo: null,
            previewUrl: null,
          });
          return;
        }
        const previewUrl =
          typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
            ? URL.createObjectURL(file)
            : null;
        const start = performance.now();
        const duration =
          900 + Math.min(80, file.size / (1024 * 1024)) * 40;
        const tick = () => {
          const elapsed = performance.now() - start;
          void Math.min(0.98, elapsed / duration);
          if (elapsed < duration) {
            requestAnimationFrame(tick);
            return;
          }
          const now = ISO_NOW();
          const aspect: GalleryPhoto['aspect'] = 'landscape';
          const baseUrl = previewUrl ?? IMG(file.name);
          setPhotos((prev) => {
            const firstCat = [...categories]
              .sort((a, b) => a.displayOrder - b.displayOrder)
              .find((c) => c.published);
            const catId = firstCat?.id ?? 'general-events';
            const sibs = prev.filter((p) => p.categoryId === catId);
            const nextOrder = Math.max(0, ...sibs.map((p) => p.displayOrder), 0) + 1;
            const photo: GalleryPhoto = {
              id: taskId,
              categoryId: catId,
              title: file.name.replace(/\.[^.]+$/, ''),
              caption:
                'Uploaded via Gallery Management. Please add caption, category, and metadata before publishing.',
              altText: file.name,
              imageUrl: baseUrl,
              thumbnailUrl: baseUrl,
              originalUrl: baseUrl,
              width: undefined,
              height: undefined,
              fileSizeBytes: file.size,
              displayOrder: nextOrder,
              published: false,
              uploadedAt: now,
              updatedAt: now,
              aspect,
            };
            const resultTask: PhotoUploadTask = {
              id: taskId,
              file,
              name: file.name,
              sizeBytes: file.size,
              progress: 100,
              status: 'success',
              error: null,
              previewUrl,
              photo,
            };
            queueMicrotask(() => resolve(resultTask));
            return [...prev, photo];
          });
        };
        requestAnimationFrame(tick);
      }),
    [categories]
  );

  const resetStore = useCallback(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }
    setCategories(DEFAULT_CATEGORIES.slice());
    setPhotos(SAMPLE_PHOTOS.slice());
  }, []);

  const value = useMemo<GalleryStoreValue>(
    () => ({
      categories,
      photos,
      createCategory,
      updateCategory,
      deleteCategory,
      toggleCategoryPublished,
      reorderCategory,
      addPhoto,
      updatePhoto,
      deletePhoto,
      togglePhotoPublished,
      movePhoto,
      reorderPhoto,
      getCategoryPhotos,
      applyFilters,
      simulateUpload,
      validateFile,
      resetStore,
    }),
    [
      categories,
      photos,
      createCategory,
      updateCategory,
      deleteCategory,
      toggleCategoryPublished,
      reorderCategory,
      addPhoto,
      updatePhoto,
      deletePhoto,
      togglePhotoPublished,
      movePhoto,
      reorderPhoto,
      getCategoryPhotos,
      applyFilters,
      simulateUpload,
      validateFile,
      resetStore,
    ]
  );

  return (
    <GalleryContext.Provider value={value}>{children}</GalleryContext.Provider>
  );
}

export function useGallery(): GalleryStoreValue {
  const ctx = useContext(GalleryContext);
  if (!ctx) {
    throw new Error('useGallery must be used within a <GalleryProvider>');
  }
  return ctx;
}
