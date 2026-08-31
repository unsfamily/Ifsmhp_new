import { useEffect, useMemo, useState } from 'react';
import {
  Images,
  Search,
  Filter,
  Download,
  Eye,
  Clock,
  Calendar,
  MapPin,
  Users,
  Tag,
  Plus,
  Upload,
  Star,
  FolderKanban,
  FileText,
  Sparkles,
  X,
  ChevronLeft,
  ChevronRight,
  Heart,
  Share2,
  MoreHorizontal,
  Trash2,
  DownloadCloud,
  Grid3X3,
  LayoutList,
  Info,
  Building2,
  Award,
  Check,
  Pause,
  Play,
  ArrowRight,
  Camera,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { SelectInput, TextInput, Checkbox } from '../../components/common/Input';

type AlbumKey = 'all' | 'symposium-2026' | 'awards-2025' | 'cro-retreat' | 'member-welcome' | 'lab-open-house';
type ItemType = 'photo' | 'video' | 'document';

interface GalleryItem {
  id: string;
  type: ItemType;
  title: string;
  caption: string;
  albumKey: Exclude<AlbumKey, 'all'>;
  albumLabel: string;
  capturedAt: string;
  location: string;
  photographer: string;
  tags: string[];
  aspect: 'landscape' | 'portrait' | 'square';
  sizeMB: number;
  resolution?: string;
  views: number;
  downloads: number;
  starred: boolean;
  creditLine: string;
}

const DEMO_LABEL = '[DEMO DATA — API pending]';

const ALBUMS: Array<{ key: AlbumKey; label: string; count: number; coverGradient: string }> = [
  { key: 'all', label: 'All Media', count: 64, coverGradient: 'from-forum-600 via-slateteal-500 to-brass-400' },
  { key: 'symposium-2026', label: 'Spring Symposium 2026', count: 18, coverGradient: 'from-forum-700 via-forum-500 to-slateteal-500' },
  { key: 'awards-2025', label: 'CRO Awards Night 2025', count: 11, coverGradient: 'from-brass-500 via-amber-500 to-orange-500' },
  { key: 'cro-retreat', label: 'CRO Strategy Retreat', count: 9, coverGradient: 'from-slateteal-700 via-forum-700 to-indigo-700' },
  { key: 'member-welcome', label: 'New Member Welcome Day', count: 14, coverGradient: 'from-emerald-500 via-teal-500 to-slateteal-500' },
  { key: 'lab-open-house', label: 'Lab Open House', count: 12, coverGradient: 'from-rose-500 via-forum-500 to-violet-500' },
];

const TYPE_OPTIONS: Array<{ value: 'all' | ItemType; label: string }> = [
  { value: 'all', label: 'All types' },
  { value: 'photo', label: 'Photos' },
  { value: 'video', label: 'Videos' },
  { value: 'document', label: 'Documents' },
];

const SORT_OPTIONS: Array<{ value: 'newest' | 'oldest' | 'popular' | 'az'; label: string }> = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'popular', label: 'Most downloaded' },
  { value: 'az', label: 'Title A → Z' },
];

const PROMPT = (subject: string) =>
  encodeURIComponent(
    `Professional institutional photograph, IFSMHP academic conference scene, ${subject}, well-lit hall with attendees in smart business attire, mixed group candid + posed composition, branded banners in background, shallow depth of field, photorealistic, high detail, editorial documentary style, warm neutral tones, no visible branding other than generic university/think-tank banners — all persons are generically detailed adults with no recognisable individuals`
  );

const IMG = (subject: string, size: 'landscape_16_9' | 'portrait_4_3' | 'square' = 'landscape_16_9') =>
  `https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=${PROMPT(subject)}&image_size=${size}`;

const ITEMS: GalleryItem[] = [
  {
    id: 'gal-001',
    type: 'photo',
    title: 'Plenary Keynote — Spring Symposium',
    caption:
      'Professor delivers opening keynote on interdisciplinary methodological frameworks to a full plenary hall.',
    albumKey: 'symposium-2026',
    albumLabel: 'Spring Symposium 2026',
    capturedAt: '2026-03-12 09:14',
    location: 'IFSMHP Forum Hall, UNS Sydney',
    photographer: 'Office of Communications',
    tags: ['keynote', 'plenary', 'forum-hall', 'symposium-2026', 'crowd'],
    aspect: 'landscape',
    sizeMB: 8.2,
    resolution: '5472 × 3648',
    views: 342,
    downloads: 61,
    starred: true,
    creditLine: 'IFSMHP / Office of Communications',
  },
  {
    id: 'gal-002',
    type: 'photo',
    title: 'Research Poster Session, Track B',
    caption: 'Members discuss poster presentations during the afternoon poster walk-around with coffee service.',
    albumKey: 'symposium-2026',
    albumLabel: 'Spring Symposium 2026',
    capturedAt: '2026-03-12 15:42',
    location: 'Exhibition Gallery, Level 2',
    photographer: 'Event Photography Unit',
    tags: ['posters', 'networking', 'symposium-2026', 'exhibition'],
    aspect: 'landscape',
    sizeMB: 6.7,
    resolution: '4928 × 3264',
    views: 218,
    downloads: 44,
    starred: false,
    creditLine: 'IFSMHP / Event Photography Unit',
  },
  {
    id: 'gal-003',
    type: 'photo',
    title: 'CRO Lifetime Achievement Award',
    caption:
      'CRO presents the 2025 Lifetime Achievement medallion during the black-tie Awards Night ceremony.',
    albumKey: 'awards-2025',
    albumLabel: 'CRO Awards Night 2025',
    capturedAt: '2025-11-28 20:19',
    location: 'Harbour View Ballroom',
    photographer: 'Ceremonial Photography',
    tags: ['awards', 'ceremony', 'medallion', 'black-tie', '2025'],
    aspect: 'portrait',
    sizeMB: 11.3,
    resolution: '6000 × 4000',
    views: 612,
    downloads: 198,
    starred: true,
    creditLine: 'IFSMHP / Ceremonial Office',
  },
  {
    id: 'gal-004',
    type: 'photo',
    title: 'Strategy Retreat — Breakout Working Group',
    caption: 'CRO Office in a white-boarding session mapping the 3-year research infrastructure plan.',
    albumKey: 'cro-retreat',
    albumLabel: 'CRO Strategy Retreat',
    capturedAt: '2026-01-22 11:07',
    location: 'Regional Retreat Centre, Blue Mountains',
    photographer: 'CRO Office staff',
    tags: ['strategy', 'workshop', 'whiteboard', 'cro-office'],
    aspect: 'landscape',
    sizeMB: 4.8,
    resolution: '4032 × 3024',
    views: 129,
    downloads: 18,
    starred: false,
    creditLine: 'IFSMHP / CRO Office internal',
  },
  {
    id: 'gal-005',
    type: 'photo',
    title: 'New Member Induction, Group Photograph',
    caption: 'The February 2026 induction cohort gathers on the Grand Staircase following the welcome address.',
    albumKey: 'member-welcome',
    albumLabel: 'New Member Welcome Day',
    capturedAt: '2026-02-05 12:33',
    location: 'Grand Staircase, IFSMHP Building',
    photographer: 'Official Photographer',
    tags: ['induction', 'new-members', 'group-photo', 'welcome-day'],
    aspect: 'landscape',
    sizeMB: 14.6,
    resolution: '8256 × 5504',
    views: 507,
    downloads: 322,
    starred: true,
    creditLine: 'IFSMHP / Official Photographer',
  },
  {
    id: 'gal-006',
    type: 'photo',
    title: 'Lab Open House — Demonstration Table',
    caption: 'Research staff demonstrate shared-instrument workflows to prospective industry partners.',
    albumKey: 'lab-open-house',
    albumLabel: 'Lab Open House',
    capturedAt: '2026-04-17 14:02',
    location: 'Materials Science Laboratory, Level 4',
    photographer: 'Research Infrastructure Unit',
    tags: ['laboratory', 'open-house', 'industry-partners', 'demo', 'instruments'],
    aspect: 'landscape',
    sizeMB: 7.1,
    resolution: '5120 × 3413',
    views: 198,
    downloads: 31,
    starred: false,
    creditLine: 'IFSMHP / Research Infrastructure',
  },
  {
    id: 'gal-007',
    type: 'photo',
    title: 'Symposium Panel — Ethics in Publication',
    caption: 'Five-member panel responds to audience questions on COI, pre-registration and replication standards.',
    albumKey: 'symposium-2026',
    albumLabel: 'Spring Symposium 2026',
    capturedAt: '2026-03-13 10:41',
    location: 'Auditorium B',
    photographer: 'Office of Communications',
    tags: ['panel', 'ethics', 'publication', 'audience', 'symposium-2026'],
    aspect: 'landscape',
    sizeMB: 5.9,
    resolution: '4896 × 3264',
    views: 264,
    downloads: 49,
    starred: false,
    creditLine: 'IFSMHP / Office of Communications',
  },
  {
    id: 'gal-008',
    type: 'video',
    title: 'Awards Night 2025 — Highlight Reel',
    caption: 'Three-minute cinematic highlight reel from the black-tie CRO Awards Night 2025 ceremony.',
    albumKey: 'awards-2025',
    albumLabel: 'CRO Awards Night 2025',
    capturedAt: '2025-11-28 21:05',
    location: 'Harbour View Ballroom',
    photographer: 'Multimedia Production',
    tags: ['video', 'highlights', 'awards-2025', 'reel'],
    aspect: 'landscape',
    sizeMB: 188.4,
    resolution: '3840 × 2160 · 03:14',
    views: 918,
    downloads: 112,
    starred: true,
    creditLine: 'IFSMHP / Multimedia Production',
  },
  {
    id: 'gal-009',
    type: 'photo',
    title: 'Retreat Dinner — Awards & Recognition',
    caption: 'Standing ovation following the presentation of the CRO Distinguished Service citation during retreat dinner.',
    albumKey: 'cro-retreat',
    albumLabel: 'CRO Strategy Retreat',
    capturedAt: '2026-01-22 19:47',
    location: 'Retreat Centre Dining Hall',
    photographer: 'CRO Office staff',
    tags: ['dinner', 'awards', 'standing-ovation', 'retreat'],
    aspect: 'landscape',
    sizeMB: 5.4,
    resolution: '4032 × 3024',
    views: 146,
    downloads: 23,
    starred: false,
    creditLine: 'IFSMHP / CRO Office internal',
  },
  {
    id: 'gal-010',
    type: 'photo',
    title: 'Welcome Day — Name Badge Pickup',
    caption: 'Volunteers at the induction welcome desk assist with lanyards, programmes and campus wayfinding maps.',
    albumKey: 'member-welcome',
    albumLabel: 'New Member Welcome Day',
    capturedAt: '2026-02-05 08:50',
    location: 'Reception Foyer, Ground Floor',
    photographer: 'Volunteer photographer',
    tags: ['welcome-desk', 'registration', 'volunteers', 'name-badges'],
    aspect: 'square',
    sizeMB: 3.6,
    resolution: '3024 × 3024',
    views: 112,
    downloads: 14,
    starred: false,
    creditLine: 'IFSMHP / Volunteer photographer',
  },
  {
    id: 'gal-011',
    type: 'document',
    title: 'Lab Open House — Floor Plan & Exhibitor Map',
    caption: 'Print-quality PDF floor plan for the April 2026 Lab Open House with exhibitor booth assignments.',
    albumKey: 'lab-open-house',
    albumLabel: 'Lab Open House',
    capturedAt: '2026-04-10 16:22',
    location: 'Digital asset',
    photographer: 'Events Office',
    tags: ['floor-plan', 'pdf', 'exhibitors', 'open-house'],
    aspect: 'landscape',
    sizeMB: 12.1,
    views: 89,
    downloads: 67,
    starred: false,
    creditLine: 'IFSMHP / Events Office',
  },
  {
    id: 'gal-012',
    type: 'photo',
    title: 'Symposium Networking Reception',
    caption: 'Attendees over canapés during the Thursday evening riverside networking reception.',
    albumKey: 'symposium-2026',
    albumLabel: 'Spring Symposium 2026',
    capturedAt: '2026-03-12 19:01',
    location: 'Riverside Terrace',
    photographer: 'Event Photography Unit',
    tags: ['reception', 'networking', 'canapes', 'evening', 'symposium-2026'],
    aspect: 'landscape',
    sizeMB: 7.8,
    resolution: '5184 × 3456',
    views: 402,
    downloads: 73,
    starred: false,
    creditLine: 'IFSMHP / Event Photography Unit',
  },
];

const TYPE_VARIANT: Record<ItemType, 'default' | 'info' | 'brass' | 'success'> = {
  photo: 'default',
  video: 'brass',
  document: 'info',
};

interface BannerSlide {
  id: string;
  eyebrow: string;
  title: string;
  lead: string;
  promptSubject: string;
  ctaPrimary: { label: string; onClick: (ctx: { setAlbum: (a: AlbumKey) => void; setOpenId: (id: string | null) => void }) => void };
  ctaSecondary: { label: string; onClick: (ctx: { setAlbum: (a: AlbumKey) => void; setOpenId: (id: string | null) => void }) => void };
  gradientOverlay: string;
  chips: Array<{ label: string; icon: 'users' | 'calendar' | 'camera' | 'download'; value?: string }>;
  tagline: string;
}

const BANNER_SLIDES: BannerSlide[] = [
  {
    id: 'bnr-symposium',
    eyebrow: 'Spring Symposium 2026 · Featured collection',
    title: 'Relive the IFSMHP Spring Symposium',
    lead: 'Three days of keynotes, poster sessions and riverside receptions — 18 curated editorial photos ready for release to public galleries, member newsletters and research profiles.',
    promptSubject: 'Academic keynote plenary hall stage with spotlighted lecturer, audience in rows of seats, branded forum banner, wide shot with depth of field',
    gradientOverlay: 'from-forum-950/85 via-forum-900/60 to-slateteal-900/40',
    tagline: 'Featured album · 18 photos · 402 views this week',
    chips: [
      { label: 'Event', icon: 'calendar', value: '12–14 Mar 2026' },
      { label: 'Attendees', icon: 'users', value: '214 members' },
      { label: 'Photos', icon: 'camera', value: '18 curated' },
      { label: 'Downloads', icon: 'download', value: '134' },
    ],
    ctaPrimary: {
      label: 'Open Spring Symposium album',
      onClick: (ctx) => ctx.setAlbum('symposium-2026'),
    },
    ctaSecondary: {
      label: 'Preview keynote plenary photo',
      onClick: (ctx) => ctx.setOpenId('gal-001'),
    },
  },
  {
    id: 'bnr-awards',
    eyebrow: 'CRO Awards Night 2025 · Hall of Fame',
    title: 'Celebrate the 2025 CRO Honours & Distinguished Citations',
    lead: 'Induction ceremonies, medals, awards dinner and the Lifetime Contribution gallery — 11 high-resolution portrait-ready assets, cleared for public web and print-quality reproduction.',
    promptSubject: 'Formal awards ceremony stage with medals, standing ovation audience, dimmed banquet hall with brass candlelight, academic regalia on recipients',
    gradientOverlay: 'from-amber-950/80 via-brass-900/55 to-rose-950/40',
    tagline: 'Hall of Fame · 11 assets · 1 pending media release',
    chips: [
      { label: 'Event', icon: 'calendar', value: '22 Nov 2025' },
      { label: 'Inductees', icon: 'users', value: '9 honourees' },
      { label: 'Photos', icon: 'camera', value: '11 edited' },
      { label: 'Downloads', icon: 'download', value: '212' },
    ],
    ctaPrimary: {
      label: 'Open Awards Night album',
      onClick: (ctx) => ctx.setAlbum('awards-2025'),
    },
    ctaSecondary: {
      label: 'Preview Lifetime Contribution portrait',
      onClick: (ctx) => ctx.setOpenId('gal-004'),
    },
  },
  {
    id: 'bnr-retreat',
    eyebrow: 'CRO Strategy Retreat · Internal collection',
    title: '2026 CRO Strategy Retreat — working sessions, posters & dinners',
    lead: 'Boardroom strategy, breakout whiteboards, poster critiques and the closing retreat dinner citation. 9 internal-use assets; mark public-ready individually before release to member or public galleries.',
    promptSubject: 'Executives in modern retreat meeting room around wooden table, whiteboards with sticky notes, notebooks, cups of coffee, daylight from floor windows',
    gradientOverlay: 'from-slateteal-950/80 via-forum-900/55 to-indigo-950/40',
    tagline: 'Internal collection · 9 assets · Sensitive until board review',
    chips: [
      { label: 'Event', icon: 'calendar', value: '20–23 Jan 2026' },
      { label: 'Attendees', icon: 'users', value: '18 CRO leads' },
      { label: 'Assets', icon: 'camera', value: '9 working' },
      { label: 'Downloads', icon: 'download', value: '23' },
    ],
    ctaPrimary: {
      label: 'Open Strategy Retreat album',
      onClick: (ctx) => ctx.setAlbum('cro-retreat'),
    },
    ctaSecondary: {
      label: 'Preview retreat dinner photo',
      onClick: (ctx) => ctx.setOpenId('gal-009'),
    },
  },
  {
    id: 'bnr-openhouse',
    eyebrow: 'Lab Open House 2026 · Public outreach',
    title: 'Open House 2026 showcases the IFSMHP research labs to 320 visitors',
    lead: 'Lab tours, demo stations, family-friendly science zone and student poster speed-talks. 12 public-ready photos + 1 exhibitor floor plan PDF, cleared for community-relations publications.',
    promptSubject: 'University laboratory open house tour with families in lab coats observing scientific experiment demos, glassware on benches, colourful beakers, friendly researchers explaining',
    gradientOverlay: 'from-rose-950/75 via-forum-900/50 to-violet-950/40',
    tagline: 'Public outreach · 12 photos · Exhibitor map PDF',
    chips: [
      { label: 'Event', icon: 'calendar', value: '18 Apr 2026' },
      { label: 'Visitors', icon: 'users', value: '320 registered' },
      { label: 'Assets', icon: 'camera', value: '12 + 1 PDF' },
      { label: 'Downloads', icon: 'download', value: '156' },
    ],
    ctaPrimary: {
      label: 'Open Lab Open House album',
      onClick: (ctx) => ctx.setAlbum('lab-open-house'),
    },
    ctaSecondary: {
      label: 'Download exhibitor floor plan',
      onClick: (ctx) => ctx.setOpenId('gal-011'),
    },
  },
];

export default function AdminGalleryPage() {
  const [search, setSearch] = useState('');
  const [album, setAlbum] = useState<AlbumKey>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | ItemType>('all');
  const [sort, setSort] = useState<(typeof SORT_OPTIONS)[number]['value']>('newest');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [starredOnly, setStarredOnly] = useState(false);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const [items, setItems] = useState<GalleryItem[]>(ITEMS);
  const [openId, setOpenId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadFlash, setUploadFlash] = useState<null | string>(null);

  const [bannerIndex, setBannerIndex] = useState(0);
  const [bannerPlaying, setBannerPlaying] = useState(true);
  const [bannerHover, setBannerHover] = useState(false);

  useEffect(() => {
    if (!bannerPlaying || bannerHover) return;
    const t = window.setInterval(() => {
      setBannerIndex((i) => (i + 1) % BANNER_SLIDES.length);
    }, 6000);
    return () => window.clearInterval(t);
  }, [bannerPlaying, bannerHover]);

  const goPrev = () => setBannerIndex((i) => (i - 1 + BANNER_SLIDES.length) % BANNER_SLIDES.length);
  const goNext = () => setBannerIndex((i) => (i + 1) % BANNER_SLIDES.length);
  const bannerCtx = { setAlbum, setOpenId };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = items.filter((it) => {
      if (album !== 'all' && it.albumKey !== album) return false;
      if (typeFilter !== 'all' && it.type !== typeFilter) return false;
      if (starredOnly && !it.starred) return false;
      if (tagFilter && !it.tags.includes(tagFilter)) return false;
      if (!q) return true;
      return (
        it.title.toLowerCase().includes(q) ||
        it.caption.toLowerCase().includes(q) ||
        it.albumLabel.toLowerCase().includes(q) ||
        it.tags.some((t) => t.toLowerCase().includes(q)) ||
        it.photographer.toLowerCase().includes(q) ||
        it.location.toLowerCase().includes(q)
      );
    });
    const by = new Map<(typeof SORT_OPTIONS)[number]['value'], (a: GalleryItem, b: GalleryItem) => number>([
      ['newest', (a, b) => b.capturedAt.localeCompare(a.capturedAt)],
      ['oldest', (a, b) => a.capturedAt.localeCompare(b.capturedAt)],
      ['popular', (a, b) => b.downloads - a.downloads],
      ['az', (a, b) => a.title.localeCompare(b.title)],
    ]);
    const cmp = by.get(sort);
    if (cmp) list = list.slice().sort(cmp);
    return list;
  }, [items, search, album, typeFilter, sort, starredOnly, tagFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  const open = items.find((i) => i.id === openId) ?? null;

  const toggleStar = (id: string) =>
    setItems((all) => all.map((it) => (it.id === id ? { ...it, starred: !it.starred } : it)));

  const tags = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => it.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [items]);

  const kpi = useMemo(() => {
    const photos = items.filter((i) => i.type === 'photo').length;
    const videos = items.filter((i) => i.type === 'video').length;
    const docs = items.filter((i) => i.type === 'document').length;
    const totalMB = items.reduce((a, it) => a + it.sizeMB, 0);
    return { photos, videos, docs, totalMB };
  }, [items]);

  const runUpload = () => {
    setUploading(true);
    setUploadFlash(null);
    setTimeout(() => {
      const id = 'gal-u' + Math.floor(Math.random() * 9000 + 1000);
      const found = ALBUMS.find((a) => a.key === album);
      const resolved = (found ?? ALBUMS[1]) as (typeof ALBUMS)[number];
      const key: Exclude<AlbumKey, 'all'> =
        resolved.key === 'all' ? 'symposium-2026' : (resolved.key as Exclude<AlbumKey, 'all'>);
      const label = resolved.key === 'all' ? 'Spring Symposium 2026' : resolved.label;
      setItems((all) => [
        {
          id,
          type: 'photo',
          title: 'Newly uploaded media ' + id.slice(-3),
          caption: 'Uploaded via the CRO Gallery admin — awaiting caption & metadata review before publish.',
          albumKey: key,
          albumLabel: label,
          capturedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
          location: 'IFSMHP Admin Upload',
          photographer: 'CRO Office (you)',
          tags: ['uploaded', 'awaiting-metadata'],
          aspect: 'landscape',
          sizeMB: 4.9,
          resolution: '4032 × 3024',
          views: 0,
          downloads: 0,
          starred: false,
          creditLine: 'IFSMHP / CRO Office upload',
        },
        ...all,
      ]);
      setUploading(false);
      setUploadFlash(
        `Media queued for review in "${label}". Add captions, tags and access controls before publishing to the public gallery.`
      );
      setTimeout(() => setUploadFlash(null), 5200);
    }, 1100);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Badge variant="brass">
              <Sparkles className="h-2.5 w-2.5 mr-1" /> {DEMO_LABEL}
            </Badge>
            <span className="text-[11px] uppercase tracking-wider text-ink-subtle font-semibold">
              CRO Office / Research &amp; Content
            </span>
          </div>
          <h1 className="font-display text-2xl font-bold text-ink">Media Gallery</h1>
          <p className="text-sm text-ink-subtle mt-1 max-w-2xl">
            Curated institutional media for IFSMHP events, awards, inductions and research showcases. Organise
            albums, tag assets, publish to public-facing collections or keep internal.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" as="link" to="/admin/events">
            <Calendar className="h-4 w-4" /> Events
          </Button>
          <Button variant="outline" as="link" to="/admin/publications">
            <FileText className="h-4 w-4" /> Publications
          </Button>
          <Button variant="secondary" onClick={runUpload} disabled={uploading}>
            {uploading ? (
              <>
                <Sparkles className="h-4 w-4 animate-pulse" /> Uploading…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" /> Upload Media
              </>
            )}
          </Button>
          <Button variant="primary" onClick={runUpload} disabled={uploading}>
            <Plus className="h-4 w-4" /> New Album
          </Button>
        </div>
      </div>

      <section
        aria-label="Featured media banner carousel"
        aria-roledescription="carousel"
        aria-live="polite"
        className="relative overflow-hidden rounded-3xl border border-ink-line/80 shadow-md"
        onMouseEnter={() => setBannerHover(true)}
        onMouseLeave={() => setBannerHover(false)}
        onFocus={() => setBannerHover(true)}
        onBlur={() => setBannerHover(false)}
      >
        <div className="relative h-[340px] sm:h-[380px] lg:h-[420px]">
          {BANNER_SLIDES.map((slide, i) => {
            const active = i === bannerIndex;
            return (
              <div
                key={slide.id}
                id={`gallery-banner-slide-${slide.id}`}
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${BANNER_SLIDES.length}: ${slide.title}`}
                aria-hidden={!active}
                className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${active ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
              >
                <img
                  src={IMG(slide.promptSubject, 'landscape_16_9')}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                  loading={i === 0 ? 'eager' : 'lazy'}
                />
                <div className={`absolute inset-0 bg-gradient-to-r ${slide.gradientOverlay}`} />
                <div className="absolute inset-0 bg-paper/5" />
                <div className="relative z-10 flex h-full items-end px-5 pb-6 sm:px-8 sm:pb-8 lg:items-center lg:px-12 lg:pb-0">
                  <div className="max-w-3xl text-forum-50">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-brass-100 backdrop-blur">
                        <Camera className="h-3.5 w-3.5" />
                        {slide.eyebrow}
                      </span>
                      <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-forum-100/70">
                        <Sparkles className="h-3.5 w-3.5 text-brass-100" />
                        {slide.tagline}
                      </span>
                    </div>
                    <h2 className="font-display text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">
                      {slide.title}
                    </h2>
                    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-forum-100/85 sm:text-base">
                      {slide.lead}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {slide.chips.map((chip) => (
                        <span
                          key={chip.label}
                          className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/90 backdrop-blur"
                        >
                          {chip.icon === 'calendar' ? <Calendar className="h-3.5 w-3.5 text-brass-100" /> : null}
                          {chip.icon === 'users' ? <Users className="h-3.5 w-3.5 text-brass-100" /> : null}
                          {chip.icon === 'camera' ? <Camera className="h-3.5 w-3.5 text-brass-100" /> : null}
                          {chip.icon === 'download' ? <Download className="h-3.5 w-3.5 text-brass-100" /> : null}
                          <span className="text-white/70">{chip.label}</span>
                          {chip.value ? <span className="font-semibold text-white">{chip.value}</span> : null}
                        </span>
                      ))}
                    </div>
                    <div className="mt-6 flex flex-wrap items-center gap-3">
                      <Button
                        variant="primary"
                        size="lg"
                        onClick={() => slide.ctaPrimary.onClick(bannerCtx)}
                        className="min-h-12 whitespace-nowrap bg-brass-500 px-6 text-forum-950 hover:bg-brass-600 focus-visible:ring-brass-300 sm:px-7"
                      >
                        {slide.ctaPrimary.label}
                        <ArrowRight className="h-4.5 w-4.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={() => slide.ctaSecondary.onClick(bannerCtx)}
                        className="min-h-12 whitespace-nowrap border-white/30 bg-white/5 px-6 text-white hover:bg-white/10 focus-visible:ring-white/50 sm:px-7"
                      >
                        {slide.ctaSecondary.label}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={goPrev}
          aria-label="Previous slide"
          className="absolute left-3 top-1/2 z-20 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-forum-950/40 text-white backdrop-blur transition hover:bg-forum-950/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-300 sm:left-4 sm:h-11 sm:w-11"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={goNext}
          aria-label="Next slide"
          className="absolute right-3 top-1/2 z-20 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-forum-950/40 text-white backdrop-blur transition hover:bg-forum-950/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-300 sm:right-4 sm:h-11 sm:w-11"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        <div className="absolute bottom-4 left-0 right-0 z-20 flex items-center justify-center gap-3 px-4 sm:bottom-6 sm:justify-between sm:px-8">
          <div className="hidden items-center gap-1.5 sm:inline-flex">
            <button
              type="button"
              onClick={() => setBannerPlaying((p) => !p)}
              aria-label={bannerPlaying ? 'Pause carousel' : 'Play carousel'}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-forum-950/35 text-white backdrop-blur hover:bg-forum-950/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-300"
            >
              {bannerPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <span className="text-[11px] font-medium uppercase tracking-wider text-white/80">
              {bannerPlaying ? 'Auto-playing · 6 s' : 'Paused'}
            </span>
          </div>
          <ol role="tablist" aria-label="Banner slides" className="flex items-center gap-2">
            {BANNER_SLIDES.map((slide, i) => (
              <li key={slide.id}>
                <button
                  role="tab"
                  aria-selected={i === bannerIndex}
                  aria-controls={`gallery-banner-slide-${slide.id}`}
                  aria-label={`Go to slide ${i + 1}`}
                  onClick={() => setBannerIndex(i)}
                  className={`h-2 rounded-full transition-all duration-500 ${
                    i === bannerIndex ? 'w-10 bg-brass-100' : 'w-2 bg-white/45 hover:bg-white/70'
                  }`}
                />
              </li>
            ))}
          </ol>
          <span className="hidden rounded-full border border-white/15 bg-forum-950/35 px-3 py-1 text-[11px] font-semibold text-white/90 backdrop-blur sm:inline-flex">
            {bannerIndex + 1} / {BANNER_SLIDES.length}
          </span>
        </div>
      </section>

      {uploadFlash && (
        <div className="rounded-xl border border-success-600/30 bg-success-100/40 p-3.5 flex items-start gap-3">
          <div className="h-7 w-7 shrink-0 rounded-lg bg-success-600/15 flex items-center justify-center text-success-700">
            <Check className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-success-900">Media received</p>
            <p className="text-sm text-success-900/80 mt-0.5">{uploadFlash}</p>
          </div>
          <button
            onClick={() => setUploadFlash(null)}
            className="text-success-800/60 hover:text-success-900"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="!bg-gradient-to-br !from-forum-600 !to-slateteal-600 !text-white !border-transparent">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-white/70 font-semibold">Media files</p>
              <p className="font-display text-3xl font-bold mt-1">{items.length}</p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-white/15 ring-1 ring-white/20 flex items-center justify-center">
              <Images className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-ink-subtle font-semibold">Photos</p>
              <p className="font-display text-2xl font-bold text-ink mt-1">{kpi.photos}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-forum-100 ring-1 ring-forum-600/20 flex items-center justify-center text-forum-700">
              <ImageIconFallback />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-ink-subtle font-semibold">Videos &amp; docs</p>
              <p className="font-display text-2xl font-bold text-ink mt-1">
                {kpi.videos} <span className="text-base text-ink-subtle font-medium">+</span> {kpi.docs}
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-brass-100 ring-1 ring-brass-600/20 flex items-center justify-center text-brass-700">
              <Award className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-ink-subtle font-semibold">Library size</p>
              <p className="font-display text-2xl font-bold text-ink mt-1">
                {kpi.totalMB >= 1000
                  ? (kpi.totalMB / 1000).toFixed(1) + ' GB'
                  : Math.round(kpi.totalMB).toLocaleString() + ' MB'}
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-slateteal-100 ring-1 ring-slateteal-600/20 flex items-center justify-center text-slateteal-700">
              <DownloadCloud className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-4">
              <TextInput
                label={<span className="text-[11px] uppercase tracking-wider font-semibold text-ink-subtle">Search media</span>}
                placeholder="Titles, captions, tags, photographers, venues…"
                value={search}
                onChange={(e) => {
                  setSearch((e.target as HTMLInputElement).value);
                  setPage(1);
                }}
                icon={<Search className="h-4 w-4" />}
              />
            </div>
            <div className="md:col-span-3">
              <SelectInput
                label={<span className="text-[11px] uppercase tracking-wider font-semibold text-ink-subtle">Album</span>}
                value={album}
                onChange={(e) => {
                  setAlbum((e.target as HTMLSelectElement).value as AlbumKey);
                  setPage(1);
                }}
              >
                {ALBUMS.map((a) => (
                  <option key={a.key} value={a.key}>
                    {a.label}
                  </option>
                ))}
              </SelectInput>
            </div>
            <div className="md:col-span-2">
              <SelectInput
                label={<span className="text-[11px] uppercase tracking-wider font-semibold text-ink-subtle">Type</span>}
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter((e.target as HTMLSelectElement).value as typeof typeFilter);
                  setPage(1);
                }}
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </SelectInput>
            </div>
            <div className="md:col-span-2">
              <SelectInput
                label={<span className="text-[11px] uppercase tracking-wider font-semibold text-ink-subtle">Sort</span>}
                value={sort}
                onChange={(e) => setSort((e.target as HTMLSelectElement).value as typeof sort)}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </SelectInput>
            </div>
            <div className="md:col-span-1 flex gap-1.5 justify-end">
              <button
                type="button"
                onClick={() => setView('grid')}
                title="Grid view"
                className={`h-9 w-9 rounded-lg border flex items-center justify-center transition ${
                  view === 'grid'
                    ? 'bg-forum-600 border-forum-600 text-white'
                    : 'bg-white border-ink-line text-ink-subtle hover:text-forum-700 hover:border-forum-600/30'
                }`}
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setView('list')}
                title="List view"
                className={`h-9 w-9 rounded-lg border flex items-center justify-center transition ${
                  view === 'list'
                    ? 'bg-forum-600 border-forum-600 text-white'
                    : 'bg-white border-ink-line text-ink-subtle hover:text-forum-700 hover:border-forum-600/30'
                }`}
              >
                <LayoutList className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <div className="flex items-center gap-1.5 mr-2">
              <Filter className="h-3.5 w-3.5 text-ink-subtle" />
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">Quick filters</span>
            </div>
            <Checkbox
              label={<span className="text-xs">Starred &amp; featured only</span>}
              checked={starredOnly}
              onChange={(e) => {
                setStarredOnly((e.target as HTMLInputElement).checked);
                setPage(1);
              }}
            />
            {tagFilter && (
              <Badge variant="info" className="!py-0.5">
                <Tag className="h-2.5 w-2.5 mr-1" /> #{tagFilter}
                <button
                  onClick={() => setTagFilter(null)}
                  className="ml-1.5 hover:text-white/90"
                  aria-label="Clear tag filter"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            )}
            <div className="ml-auto text-xs text-ink-subtle inline-flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5" />
              Showing <span className="font-semibold text-ink">{filtered.length}</span> of {items.length} assets
            </div>
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-ink-line/60 -mx-4 px-4 mt-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle inline-flex items-center gap-1 mr-1 py-1">
                <Tag className="h-3 w-3" /> Tags
              </span>
              {tags.slice(0, 22).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setTagFilter((cur) => (cur === t ? null : t));
                    setPage(1);
                  }}
                  className={`text-[11px] px-2 py-1 rounded-full border transition ${
                    tagFilter === t
                      ? 'bg-forum-600 border-forum-600 text-white'
                      : 'bg-white border-ink-line text-ink hover:border-forum-600/40 hover:text-forum-700'
                  }`}
                >
                  #{t}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-12 gap-5">
        <aside className="col-span-12 lg:col-span-3 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderKanban className="h-4 w-4 text-forum-700" />
                <span className="font-display font-semibold text-ink">Albums</span>
              </div>
              <Button variant="ghost" size="sm">
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-ink-line/60">
              {ALBUMS.map((a) => {
                const active = album === a.key;
                return (
                  <button
                    key={a.key}
                    onClick={() => {
                      setAlbum(a.key);
                      setPage(1);
                    }}
                    className={`w-full text-left flex items-center gap-3 p-3 transition ${
                      active
                        ? 'bg-forum-50/60 ring-1 ring-inset ring-forum-600/20'
                        : 'hover:bg-forum-50/30'
                    }`}
                  >
                    <div
                      className={`h-10 w-10 shrink-0 rounded-lg bg-gradient-to-br ${a.coverGradient} shadow-sm ring-1 ring-black/5 flex items-center justify-center text-white`}
                    >
                      <Images className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium truncate ${active ? 'text-forum-900' : 'text-ink'}`}>
                        {a.label}
                      </p>
                      <p className="text-[11px] text-ink-subtle mt-0.5">{a.count} media · 1 album</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-ink-subtle shrink-0" />
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-brass-500" />
                <span className="font-display font-semibold text-ink">Featured picks</span>
              </div>
            </CardHeader>
            <CardContent className="p-3 space-y-2">
              {items
                .filter((i) => i.starred)
                .slice(0, 4)
                .map((it) => (
                  <button
                    key={it.id}
                    onClick={() => setOpenId(it.id)}
                    className="w-full text-left flex items-center gap-3 rounded-lg p-2 hover:bg-forum-50/50 transition ring-1 ring-transparent hover:ring-ink-line"
                  >
                    <div className="h-12 w-16 shrink-0 rounded-md bg-gradient-to-br from-forum-600 via-slateteal-500 to-brass-400 overflow-hidden">
                      <img
                        src={IMG(it.title)}
                        alt=""
                        className="h-full w-full object-cover opacity-90"
                        loading="lazy"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-ink truncate">{it.title}</p>
                      <p className="text-[11px] text-ink-subtle mt-0.5 truncate">{it.albumLabel}</p>
                    </div>
                  </button>
                ))}
              {items.filter((i) => i.starred).length === 0 && (
                <p className="text-xs text-ink-subtle p-2">No starred media — click the star on any asset.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldIconFallback />
                <span className="font-display font-semibold text-ink">Admin actions</span>
              </div>
            </CardHeader>
            <CardContent className="p-3 space-y-2">
              <Button variant="outline" className="w-full" onClick={runUpload} disabled={uploading}>
                <Upload className="h-3.5 w-3.5" /> Bulk upload ZIP
              </Button>
              <Button variant="outline" className="w-full">
                <Download className="h-3.5 w-3.5" /> Export library CSV
              </Button>
              <Button variant="outline" className="w-full">
                <Building2 className="h-3.5 w-3.5" /> Public-facing collections
              </Button>
              <Button variant="ghost" className="w-full">
                <Trash2 className="h-3.5 w-3.5" /> Empty deleted bin
              </Button>
            </CardContent>
          </Card>
        </aside>

        <section className="col-span-12 lg:col-span-9 space-y-4">
          {pageItems.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center">
                <div className="h-14 w-14 mx-auto rounded-2xl bg-forum-50 ring-1 ring-forum-600/15 flex items-center justify-center text-forum-600 mb-3">
                  <Images className="h-6 w-6" />
                </div>
                <p className="font-display text-lg font-semibold text-ink">No media matches these filters</p>
                <p className="text-sm text-ink-subtle mt-1 max-w-lg mx-auto">
                  Try a different album, clear the tag or starred-only toggle, or search with a broader keyword.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearch('');
                      setAlbum('all');
                      setTypeFilter('all');
                      setStarredOnly(false);
                      setTagFilter(null);
                      setPage(1);
                    }}
                  >
                    Reset filters
                  </Button>
                  <Button variant="secondary" onClick={runUpload}>
                    <Plus className="h-4 w-4" /> Upload new media
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : view === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {pageItems.map((it) => (
                <Card key={it.id} className="overflow-hidden group">
                  <button
                    onClick={() => setOpenId(it.id)}
                    className="relative block w-full overflow-hidden bg-ink-line/40"
                  >
                    <div
                      className={`aspect-video ${
                        it.aspect === 'portrait' ? 'aspect-[4/5]' : it.aspect === 'square' ? 'aspect-square' : ''
                      } bg-gradient-to-br from-forum-700 via-slateteal-600 to-brass-500`}
                    >
                      <img
                        src={
                          it.type === 'video'
                            ? IMG(it.title + ', video still frame, cinematic composition')
                            : it.type === 'document'
                            ? IMG(it.title + ', printed document on oak boardroom table, editorial')
                            : IMG(it.title, it.aspect === 'portrait' ? 'portrait_4_3' : it.aspect === 'square' ? 'square' : 'landscape_16_9')
                        }
                        alt={it.title}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                        loading="lazy"
                      />
                    </div>
                    <div className="absolute inset-x-0 top-0 flex items-start justify-between p-2.5">
                      <Badge variant={TYPE_VARIANT[it.type]} className="!text-[10px] !py-0">
                        {it.type === 'photo' ? (
                          <>
                            <ImageIconFallbackSmall /> Photo
                          </>
                        ) : it.type === 'video' ? (
                          <>
                            <PlayIconFallback /> Video
                          </>
                        ) : (
                          <>
                            <FileText className="h-2.5 w-2.5 mr-1" /> Doc
                          </>
                        )}
                      </Badge>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleStar(it.id);
                          }}
                          className={`h-7 w-7 rounded-full flex items-center justify-center backdrop-blur transition ${
                            it.starred
                              ? 'bg-brass-500 text-white shadow'
                              : 'bg-ink-900/40 text-white hover:bg-ink-900/60'
                          }`}
                          aria-label={it.starred ? 'Unstar' : 'Star'}
                        >
                          <Star className={`h-3.5 w-3.5 ${it.starred ? 'fill-white' : ''}`} />
                        </button>
                      </div>
                    </div>
                    {it.type === 'video' && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-12 w-12 rounded-full bg-black/45 backdrop-blur-sm ring-1 ring-white/25 flex items-center justify-center text-white">
                          <PlayIconFallbackLarge />
                        </div>
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-ink-900/80 via-ink-900/40 to-transparent text-white opacity-0 group-hover:opacity-100 transition">
                      <p className="text-[11px] inline-flex items-center gap-1">
                        <Eye className="h-3 w-3" /> {it.views} views · <Download className="h-3 w-3" /> {it.downloads} downloads
                      </p>
                    </div>
                  </button>
                  <CardContent className="p-3.5 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-ink leading-snug line-clamp-2">{it.title}</h3>
                      <button
                        className="shrink-0 h-7 w-7 rounded-md border border-ink-line text-ink-subtle hover:text-forum-700 hover:border-forum-600/30 inline-flex items-center justify-center"
                        aria-label="More options"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-xs text-ink-subtle line-clamp-2">{it.caption}</p>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-subtle">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {it.capturedAt}
                      </span>
                      <span className="h-1 w-1 rounded-full bg-ink-line mx-0.5" />
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {it.location.split(',')[0]}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {it.tags.slice(0, 4).map((t) => (
                        <button
                          key={t}
                          onClick={() => {
                            setTagFilter(t);
                            setPage(1);
                          }}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-forum-50 text-forum-700 border border-forum-600/20 hover:bg-forum-100"
                        >
                          #{t}
                        </button>
                      ))}
                      {it.tags.length > 4 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-paper-raised text-ink-subtle border border-ink-line">
                          +{it.tags.length - 4}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 pt-1 border-t border-ink-line/60">
                      <Button variant="outline" size="sm" onClick={() => setOpenId(it.id)}>
                        <Eye className="h-3.5 w-3.5" /> Preview
                      </Button>
                      <Button variant="outline" size="sm">
                        <Download className="h-3.5 w-3.5" /> Download
                      </Button>
                      <div className="ml-auto flex items-center gap-1">
                        <button
                          className="h-7 w-7 rounded-md border border-ink-line text-ink-subtle hover:text-forum-700 hover:border-forum-600/30 inline-flex items-center justify-center"
                          aria-label="Share"
                        >
                          <Share2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => toggleStar(it.id)}
                          className={`h-7 w-7 rounded-md border inline-flex items-center justify-center transition ${
                            it.starred
                              ? 'bg-brass-50 border-brass-500 text-brass-600'
                              : 'border-ink-line text-ink-subtle hover:text-brass-600 hover:border-brass-400/50'
                          }`}
                          aria-label={it.starred ? 'Unstar' : 'Star'}
                        >
                          <Star className={`h-3.5 w-3.5 ${it.starred ? 'fill-brass-500' : ''}`} />
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="divide-y divide-ink-line/60 p-0">
                {pageItems.map((it) => (
                  <div key={it.id} className="flex flex-col sm:flex-row gap-3 p-3.5">
                    <button
                      onClick={() => setOpenId(it.id)}
                      className="sm:w-56 w-full h-36 sm:h-32 shrink-0 overflow-hidden rounded-lg ring-1 ring-ink-line bg-gradient-to-br from-forum-700 via-slateteal-600 to-brass-400"
                    >
                      <img
                        src={IMG(it.title, it.aspect === 'portrait' ? 'portrait_4_3' : 'landscape_16_9')}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </button>
                    <div className="min-w-0 flex-1 flex flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant={TYPE_VARIANT[it.type]} className="!text-[10px] !py-0">
                              {it.type === 'photo' ? 'Photo' : it.type === 'video' ? 'Video' : 'Document'}
                            </Badge>
                            <Badge variant="info" className="!text-[10px] !py-0">
                              <FolderKanban className="h-2.5 w-2.5 mr-1" />
                              {it.albumLabel}
                            </Badge>
                            {it.starred && (
                              <Badge variant="brass" className="!text-[10px] !py-0">
                                <Star className="h-2.5 w-2.5 mr-1 fill-white" /> Featured
                              </Badge>
                            )}
                          </div>
                          <h3 className="font-semibold text-ink mt-1.5">{it.title}</h3>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => toggleStar(it.id)}>
                            <Star className={`h-3.5 w-3.5 ${it.starred ? 'fill-brass-500 text-brass-500' : ''}`} />
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-ink-subtle line-clamp-2 mt-1">{it.caption}</p>
                      <div className="mt-auto pt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-subtle">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {it.capturedAt}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {it.location}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3 w-3" /> {it.photographer}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Eye className="h-3 w-3" /> {it.views}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Download className="h-3 w-3" /> {it.downloads}
                        </span>
                        {it.resolution && (
                          <span className="inline-flex items-center gap-1">
                            <Info className="h-3 w-3" /> {it.resolution}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 pt-2 mt-1 border-t border-ink-line/60">
                        <Button variant="outline" size="sm" onClick={() => setOpenId(it.id)}>
                          <Eye className="h-3.5 w-3.5" /> Preview
                        </Button>
                        <Button variant="outline" size="sm">
                          <Download className="h-3.5 w-3.5" />
                          {it.sizeMB >= 100
                            ? `Download ${(it.sizeMB / 1000).toFixed(1)} GB`
                            : `Download ${it.sizeMB.toFixed(0)} MB`}
                        </Button>
                        <div className="ml-auto flex flex-wrap gap-1">
                          {it.tags.slice(0, 4).map((t) => (
                            <button
                              key={t}
                              onClick={() => {
                                setTagFilter(t);
                                setPage(1);
                              }}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-forum-50 text-forum-700 border border-forum-600/20 hover:bg-forum-100"
                            >
                              #{t}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <p className="text-xs text-ink-subtle">
                Page {page} of {totalPages} · {filtered.length} assets total
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className={`h-8 min-w-8 px-2 rounded-md text-xs font-semibold transition ${
                      page === n
                        ? 'bg-forum-600 text-white'
                        : 'bg-white border border-ink-line text-ink hover:border-forum-600/40 hover:text-forum-700'
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-ink-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setOpenId(null)}
        >
          <div
            className="w-full sm:max-w-5xl max-h-[92vh] bg-paper rounded-t-2xl sm:rounded-2xl ring-1 shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 p-3.5 border-b border-ink-line/70">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant={TYPE_VARIANT[open.type]} className="!text-[10px] !py-0">
                    {open.type === 'photo' ? 'Photo' : open.type === 'video' ? 'Video' : 'Document'}
                  </Badge>
                  <Badge variant="info" className="!text-[10px] !py-0">
                    <FolderKanban className="h-2.5 w-2.5 mr-1" /> {open.albumLabel}
                  </Badge>
                </div>
                <h3 className="font-display text-base font-semibold text-ink mt-1 truncate">{open.title}</h3>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="sm" onClick={() => toggleStar(open.id)}>
                  <Star className={`h-4 w-4 ${open.starred ? 'fill-brass-500 text-brass-500' : ''}`} />
                </Button>
                <Button variant="ghost" size="sm">
                  <Share2 className="h-4 w-4" />
                </Button>
                <button
                  onClick={() => setOpenId(null)}
                  className="h-8 w-8 rounded-lg border border-ink-line text-ink-subtle hover:text-forum-700 hover:border-forum-600/30 inline-flex items-center justify-center"
                  aria-label="Close preview"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-0 overflow-y-auto">
              <div className="md:col-span-3 bg-ink border-b md:border-b-0 md:border-r border-ink-line relative">
                <div className="min-h-[280px] md:min-h-[520px] flex items-center justify-center p-4">
                  {open.type === 'video' ? (
                    <div className="relative w-full max-h-[70vh] rounded-lg overflow-hidden aspect-video bg-black shadow-lg ring-1 ring-white/10">
                      <img src={IMG(open.title + ', video still frame')} alt="" className="w-full h-full object-cover opacity-90" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-16 w-16 rounded-full bg-white/15 backdrop-blur-sm ring-1 ring-white/30 flex items-center justify-center text-white">
                          <PlayIconFallbackXl />
                        </div>
                      </div>
                    </div>
                  ) : open.type === 'document' ? (
                    <div className="w-full max-h-[70vh] max-w-md bg-white rounded-lg shadow-xl ring-1 ring-ink-line p-8 flex flex-col items-start">
                      <div className="flex items-center gap-2 mb-4">
                        <FileText className="h-5 w-5 text-forum-700" />
                        <Badge variant="info" className="!text-[10px] !py-0">
                          PDF · {open.sizeMB.toFixed(1)} MB
                        </Badge>
                      </div>
                      <h4 className="font-display text-lg font-bold text-ink">{open.title}</h4>
                      <p className="text-xs text-ink-subtle mt-1">{open.creditLine} · {open.capturedAt}</p>
                      <div className="mt-5 space-y-2.5 w-full">
                        <div className="h-2 w-5/6 rounded bg-ink-line/70" />
                        <div className="h-2 w-full rounded bg-ink-line/50" />
                        <div className="h-2 w-full rounded bg-ink-line/50" />
                        <div className="h-2 w-4/6 rounded bg-ink-line/50" />
                        <div className="h-2 w-full rounded bg-ink-line/30" />
                      </div>
                    </div>
                  ) : (
                    <img
                      src={IMG(open.title, open.aspect === 'portrait' ? 'portrait_4_3' : open.aspect === 'square' ? 'square' : 'landscape_16_9')}
                      alt={open.title}
                      className="max-h-[70vh] w-auto max-w-full rounded-lg shadow-2xl object-contain ring-1 ring-white/10"
                    />
                  )}
                </div>
              </div>
              <div className="md:col-span-2 p-5 space-y-4">
                <div>
                  <p className="text-[11px] uppercase tracking-wider font-semibold text-ink-subtle mb-1">Caption</p>
                  <p className="text-sm text-ink leading-relaxed">{open.caption}</p>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-subtle mb-0.5">Captured</p>
                    <p className="text-ink inline-flex items-center gap-1"><Calendar className="h-3 w-3 text-ink-subtle" />{open.capturedAt}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-subtle mb-0.5">Location</p>
                    <p className="text-ink inline-flex items-center gap-1"><MapPin className="h-3 w-3 text-ink-subtle" />{open.location}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-subtle mb-0.5">Photographer</p>
                    <p className="text-ink inline-flex items-center gap-1"><Users className="h-3 w-3 text-ink-subtle" />{open.photographer}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-subtle mb-0.5">Credit line</p>
                    <p className="text-ink">{open.creditLine}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-subtle mb-0.5">Size</p>
                    <p className="text-ink">{open.sizeMB >= 1000 ? (open.sizeMB / 1000).toFixed(1) + ' GB' : open.sizeMB.toFixed(1) + ' MB'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-subtle mb-0.5">Resolution / Duration</p>
                    <p className="text-ink">{open.resolution ?? '—'}</p>
                  </div>
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-wider font-semibold text-ink-subtle mb-1.5">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {open.tags.map((t) => (
                      <span
                        key={t}
                        className="text-[11px] px-2 py-0.5 rounded-full bg-forum-50 text-forum-700 border border-forum-600/20"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs border-y border-ink-line/60 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1 text-ink-subtle">
                      <Eye className="h-3.5 w-3.5" />
                      <span className="font-semibold text-ink">{open.views}</span> views
                    </span>
                    <span className="inline-flex items-center gap-1 text-ink-subtle">
                      <Download className="h-3.5 w-3.5" />
                      <span className="font-semibold text-ink">{open.downloads}</span> downloads
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-ink-subtle">
                    <Heart className="h-3.5 w-3.5" /> Featured
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  <Button variant="primary" className="w-full">
                    <Download className="h-4 w-4" /> Download original
                  </Button>
                  <div className="grid grid-cols-3 gap-2">
                    <Button variant="outline" size="sm">
                      <Share2 className="h-3.5 w-3.5" /> Share
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => toggleStar(open.id)}>
                      <Star className={`h-3.5 w-3.5 ${open.starred ? 'fill-brass-500 text-brass-500' : ''}`} />
                      {open.starred ? 'Unstar' : 'Star'}
                    </Button>
                    <Button variant="outline" size="sm">
                      <Tag className="h-3.5 w-3.5" /> Edit tags
                    </Button>
                  </div>
                  <Button variant="ghost" size="sm" className="!justify-start">
                    <Trash2 className="h-3.5 w-3.5 text-danger-600" />
                    <span className="text-danger-700">Move to deleted bin</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ImageIconFallback() {
  return <Images className="h-5 w-5" />;
}
function ImageIconFallbackSmall() {
  return <Images className="h-2.5 w-2.5 mr-1" />;
}
function ShieldIconFallback() {
  return <ShieldIconStandalone />;
}
function ShieldIconStandalone() {
  return <Heart className="h-4 w-4" />;
}
function PlayIconFallback() {
  return (
    <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 mr-1 fill-current" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
function PlayIconFallbackLarge() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current ml-0.5" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
function PlayIconFallbackXl() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8 fill-current ml-1" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
