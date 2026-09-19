import { useMemo, useState } from 'react';
import {
  Images,
  Search,
  Filter,
  Download,
  Eye,
  Calendar,
  MapPin,
  Tag,
  ChevronDown,
  Star,
  FolderKanban,
  FileText,
  X,
  Share2,
  MoreHorizontal,
  Grid3X3,
  LayoutList,
  Info,
  Award,
  ChevronRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Section from '../../components/common/Section';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';

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

const ALBUMS: Array<{ key: AlbumKey; label: string; count: number; coverGradient: string }> = [
  { key: 'all', label: 'All Media', count: 52, coverGradient: 'from-forum-600 via-slateteal-500 to-brass-400' },
  { key: 'symposium-2026', label: 'Spring Symposium 2026', count: 18, coverGradient: 'from-forum-700 via-forum-500 to-slateteal-500' },
  { key: 'awards-2025', label: 'CRO Awards Night 2025', count: 11, coverGradient: 'from-brass-700 via-brass-500 to-brass-200' },
  { key: 'cro-retreat', label: 'CRO Strategy Retreat', count: 9, coverGradient: 'from-slateteal-700 via-forum-700 to-forum-900' },
  { key: 'member-welcome', label: 'New Member Welcome Day', count: 14, coverGradient: 'from-forum-500 via-slateteal-500 to-brass-400' },
  { key: 'lab-open-house', label: 'Lab Open House', count: 12, coverGradient: 'from-brass-600 via-forum-600 to-forum-800' },
];

const CATEGORIES: AlbumKey[] = ['all', 'symposium-2026', 'awards-2025', 'cro-retreat', 'member-welcome', 'lab-open-house'];

const PROMPT = (subject: string) =>
  encodeURIComponent(
    `Professional institutional photograph, IFSMHP academic conference scene, ${subject}, well-lit hall with attendees in smart business attire, mixed group candid + posed composition, branded banners in background, shallow depth of field, photorealistic, high detail, editorial documentary style, warm neutral tones — all persons are generically detailed adults with no recognisable individuals`
  );

const IMG = (subject: string, size: 'landscape_16_9' | 'portrait_4_3' | 'square' = 'landscape_16_9') =>
  `https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=${PROMPT(subject)}&image_size=${size}`;

const ITEMS: GalleryItem[] = [
  {
    id: 'g-001',
    type: 'photo',
    title: 'Plenary Keynote — Spring Symposium',
    caption: 'Professor delivers opening keynote on interdisciplinary methodological frameworks to a full plenary hall.',
    albumKey: 'symposium-2026',
    albumLabel: 'Spring Symposium 2026',
    capturedAt: '2026-03-12',
    location: 'IFSMHP Forum Hall, India',
    photographer: 'Office of Communications',
    tags: ['keynote', 'plenary', 'symposium-2026'],
    aspect: 'landscape',
    sizeMB: 8.2,
    resolution: '5472 × 3648',
    views: 1342,
    downloads: 261,
    starred: true,
    creditLine: 'IFSMHP / Office of Communications',
  },
  {
    id: 'g-002',
    type: 'photo',
    title: 'Research Poster Session, Track B',
    caption: 'Members discuss poster presentations during the afternoon poster walk-around with coffee service.',
    albumKey: 'symposium-2026',
    albumLabel: 'Spring Symposium 2026',
    capturedAt: '2026-03-12',
    location: 'Exhibition Gallery, Level 2',
    photographer: 'Event Photography Unit',
    tags: ['posters', 'networking', 'symposium-2026'],
    aspect: 'landscape',
    sizeMB: 6.7,
    resolution: '4928 × 3264',
    views: 918,
    downloads: 144,
    starred: false,
    creditLine: 'IFSMHP / Event Photography Unit',
  },
  {
    id: 'g-003',
    type: 'photo',
    title: 'CRO Lifetime Achievement Award',
    caption: 'CRO presents the 2025 Lifetime Achievement medallion during the black-tie Awards Night ceremony.',
    albumKey: 'awards-2025',
    albumLabel: 'CRO Awards Night 2025',
    capturedAt: '2025-11-28',
    location: 'Harbour View Ballroom',
    photographer: 'Ceremonial Photography',
    tags: ['awards', 'ceremony', 'medallion'],
    aspect: 'portrait',
    sizeMB: 11.3,
    resolution: '6000 × 4000',
    views: 2601,
    downloads: 798,
    starred: true,
    creditLine: 'IFSMHP / Ceremonial Office',
  },
  {
    id: 'g-004',
    type: 'photo',
    title: 'Strategy Retreat — Breakout Working Group',
    caption: 'CRO Office in a white-boarding session mapping the 3-year research infrastructure plan.',
    albumKey: 'cro-retreat',
    albumLabel: 'CRO Strategy Retreat',
    capturedAt: '2026-01-22',
    location: 'Regional Retreat Centre, Blue Mountains',
    photographer: 'CRO Office staff',
    tags: ['strategy', 'workshop', 'whiteboard'],
    aspect: 'landscape',
    sizeMB: 4.8,
    resolution: '4032 × 3024',
    views: 549,
    downloads: 72,
    starred: false,
    creditLine: 'IFSMHP / CRO Office internal',
  },
  {
    id: 'g-005',
    type: 'photo',
    title: 'New Member Induction, Group Photograph',
    caption: 'The February 2026 induction cohort gathers on the Grand Staircase following the welcome address.',
    albumKey: 'member-welcome',
    albumLabel: 'New Member Welcome Day',
    capturedAt: '2026-02-05',
    location: 'Grand Staircase, IFSMHP Building',
    photographer: 'Official Photographer',
    tags: ['induction', 'new-members', 'group-photo'],
    aspect: 'landscape',
    sizeMB: 14.6,
    resolution: '8256 × 5504',
    views: 2103,
    downloads: 1302,
    starred: true,
    creditLine: 'IFSMHP / Official Photographer',
  },
  {
    id: 'g-006',
    type: 'photo',
    title: 'Lab Open House — Demonstration Table',
    caption: 'Research staff demonstrate shared-instrument workflows to prospective industry partners.',
    albumKey: 'lab-open-house',
    albumLabel: 'Lab Open House',
    capturedAt: '2026-04-17',
    location: 'Materials Science Laboratory, Level 4',
    photographer: 'Research Infrastructure Unit',
    tags: ['laboratory', 'open-house', 'industry-partners'],
    aspect: 'landscape',
    sizeMB: 7.1,
    resolution: '5120 × 3413',
    views: 812,
    downloads: 131,
    starred: false,
    creditLine: 'IFSMHP / Research Infrastructure',
  },
  {
    id: 'g-007',
    type: 'photo',
    title: 'Symposium Panel — Ethics in Publication',
    caption: 'Five-member panel responds to audience questions on COI, pre-registration and replication standards.',
    albumKey: 'symposium-2026',
    albumLabel: 'Spring Symposium 2026',
    capturedAt: '2026-03-13',
    location: 'Auditorium B',
    photographer: 'Office of Communications',
    tags: ['panel', 'ethics', 'publication'],
    aspect: 'landscape',
    sizeMB: 5.9,
    resolution: '4896 × 3264',
    views: 1064,
    downloads: 208,
    starred: false,
    creditLine: 'IFSMHP / Office of Communications',
  },
  {
    id: 'g-008',
    type: 'video',
    title: 'Awards Night 2025 — Highlight Reel',
    caption: 'Three-minute cinematic highlight reel from the black-tie CRO Awards Night 2025 ceremony.',
    albumKey: 'awards-2025',
    albumLabel: 'CRO Awards Night 2025',
    capturedAt: '2025-11-28',
    location: 'Harbour View Ballroom',
    photographer: 'Multimedia Production',
    tags: ['video', 'highlights', 'awards-2025'],
    aspect: 'landscape',
    sizeMB: 188.4,
    resolution: '3840 × 2160 · 03:14',
    views: 3918,
    downloads: 512,
    starred: true,
    creditLine: 'IFSMHP / Multimedia Production',
  },
  {
    id: 'g-009',
    type: 'photo',
    title: 'Retreat Dinner — Awards & Recognition',
    caption: 'Standing ovation following the presentation of the CRO Distinguished Service citation during retreat dinner.',
    albumKey: 'cro-retreat',
    albumLabel: 'CRO Strategy Retreat',
    capturedAt: '2026-01-22',
    location: 'Retreat Centre Dining Hall',
    photographer: 'CRO Office staff',
    tags: ['dinner', 'awards', 'standing-ovation'],
    aspect: 'landscape',
    sizeMB: 5.4,
    resolution: '4032 × 3024',
    views: 611,
    downloads: 94,
    starred: false,
    creditLine: 'IFSMHP / CRO Office internal',
  },
  {
    id: 'g-010',
    type: 'photo',
    title: 'Welcome Day — Name Badge Pickup',
    caption: 'Volunteers at the induction welcome desk assist with lanyards, programmes and campus wayfinding maps.',
    albumKey: 'member-welcome',
    albumLabel: 'New Member Welcome Day',
    capturedAt: '2026-02-05',
    location: 'Reception Foyer, Ground Floor',
    photographer: 'Volunteer photographer',
    tags: ['welcome-desk', 'registration', 'volunteers'],
    aspect: 'square',
    sizeMB: 3.6,
    resolution: '3024 × 3024',
    views: 477,
    downloads: 56,
    starred: false,
    creditLine: 'IFSMHP / Volunteer photographer',
  },
  {
    id: 'g-011',
    type: 'document',
    title: 'Lab Open House — Floor Plan & Exhibitor Map',
    caption: 'Print-quality PDF floor plan for the April 2026 Lab Open House with exhibitor booth assignments.',
    albumKey: 'lab-open-house',
    albumLabel: 'Lab Open House',
    capturedAt: '2026-04-10',
    location: 'Digital asset',
    photographer: 'Events Office',
    tags: ['floor-plan', 'pdf', 'exhibitors'],
    aspect: 'landscape',
    sizeMB: 12.1,
    views: 389,
    downloads: 267,
    starred: false,
    creditLine: 'IFSMHP / Events Office',
  },
  {
    id: 'g-012',
    type: 'photo',
    title: 'Symposium Networking Reception',
    caption: 'Attendees over canapés during the Thursday evening riverside networking reception.',
    albumKey: 'symposium-2026',
    albumLabel: 'Spring Symposium 2026',
    capturedAt: '2026-03-12',
    location: 'Riverside Terrace',
    photographer: 'Event Photography Unit',
    tags: ['reception', 'networking', 'canapes'],
    aspect: 'landscape',
    sizeMB: 7.8,
    resolution: '5184 × 3456',
    views: 1702,
    downloads: 313,
    starred: false,
    creditLine: 'IFSMHP / Event Photography Unit',
  },
];

const TYPE_VARIANT: Record<ItemType, 'default' | 'info' | 'brass' | 'success'> = {
  photo: 'default',
  video: 'brass',
  document: 'info',
};

export default function PublicGalleryPage() {
  const [search, setSearch] = useState('');
  const [album, setAlbum] = useState<AlbumKey>('all');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ITEMS.filter((it) => {
      if (album !== 'all' && it.albumKey !== album) return false;
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
  }, [search, album]);

  const open = ITEMS.find((i) => i.id === openId) ?? null;

  return (
    <>
      <section className="bg-gradient-to-br from-forum-700 via-forum-800 to-slateteal-800 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-20 mix-blend-overlay"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.08), transparent 40%), radial-gradient(circle at 80% 30%, rgba(255,255,255,0.05), transparent 45%)',
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-brass-100 ring-1 ring-inset ring-white/20">
              <Images className="h-3.5 w-3.5" />
              Media Gallery
            </span>
            <h1 className="mt-6 text-4xl font-display font-semibold leading-tight text-white sm:text-5xl">
              Moments from the IFSMHP Community
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-forum-100/80">
              Browse curated photos, highlight reels and event archives from symposia, awards, inductions and
              research showcases across the forum.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-forum-100 ring-1 ring-inset ring-white/15">
                <Images className="h-4 w-4 text-brass-100" />
                {ITEMS.length} media assets
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-forum-100 ring-1 ring-inset ring-white/15">
                <Award className="h-4 w-4 text-brass-100" />
                {ALBUMS.length - 1} event albums
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-forum-100 ring-1 ring-inset ring-white/15">
                <Star className="h-4 w-4 text-brass-200 fill-brass-200" />
                {ITEMS.filter((i) => i.starred).length} featured picks
              </div>
            </div>
          </div>
        </div>
      </section>

      <Section bg="paper" className="pb-6">
        <div className="rounded-xl border border-paper-border bg-paper-raised p-4 sm:p-6 shadow-sm">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-subtle" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search gallery: titles, captions, tags, venues…"
                className="w-full rounded-md border border-paper-border bg-paper pl-10 pr-4 py-2.5 text-sm shadow-sm transition-colors focus:border-forum-600 focus:outline-none focus:ring-2 focus:ring-forum-600 focus:ring-offset-1 focus:ring-offset-paper"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-paper-border bg-paper px-4 py-2.5 text-sm font-medium text-ink-muted hover:bg-forum-50 hover:text-forum-700 lg:hidden"
              >
                <Filter className="h-4.5 w-4.5" />
                Filters
                <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </button>
              <div className="hidden lg:flex items-center gap-1 border border-paper-border rounded-md p-0.5 bg-paper">
                <button
                  type="button"
                  onClick={() => setView('grid')}
                  title="Grid view"
                  className={`h-8 w-8 rounded flex items-center justify-center transition ${
                    view === 'grid'
                      ? 'bg-forum-600 text-white shadow-sm'
                      : 'text-ink-subtle hover:text-forum-700'
                  }`}
                >
                  <Grid3X3 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setView('list')}
                  title="List view"
                  className={`h-8 w-8 rounded flex items-center justify-center transition ${
                    view === 'list'
                      ? 'bg-forum-600 text-white shadow-sm'
                      : 'text-ink-subtle hover:text-forum-700'
                  }`}
                >
                  <LayoutList className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className={`mt-5 ${showFilters ? 'block' : 'hidden lg:block'}`}>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                Browse Albums
              </label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => {
                  const a = ALBUMS.find((x) => x.key === c)!;
                  const active = album === c;
                  return (
                    <button
                      key={c}
                      onClick={() => setAlbum(c)}
                      className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                        active
                          ? 'bg-forum-600 text-white shadow-sm'
                          : 'bg-forum-50 text-forum-700 hover:bg-forum-100'
                      }`}
                    >
                      <FolderKanban className="h-3.5 w-3.5" />
                      {a.label}
                      <span
                        className={`ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${
                          active ? 'bg-white/15 text-white' : 'bg-white text-forum-700 ring-1 ring-forum-600/20'
                        }`}
                      >
                        {a.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section bg="paper" className="pt-0">
        <div className="grid grid-cols-12 gap-5">
          <aside className="col-span-12 lg:col-span-3 space-y-4">
            <div className="rounded-xl border border-paper-border bg-paper-raised overflow-hidden">
              <div className="px-4 py-3 border-b border-paper-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FolderKanban className="h-4 w-4 text-forum-700" />
                  <span className="font-display font-semibold text-ink">Albums</span>
                </div>
              </div>
              <div className="divide-y divide-paper-border/70">
                {ALBUMS.map((a) => {
                  const active = album === a.key;
                  return (
                    <button
                      key={a.key}
                      onClick={() => setAlbum(a.key)}
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
                        <p className="text-[11px] text-ink-subtle mt-0.5">{a.count} media</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-ink-subtle shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-paper-border bg-paper-raised overflow-hidden">
              <div className="px-4 py-3 border-b border-paper-border flex items-center gap-2">
                <Star className="h-4 w-4 text-brass-500 fill-brass-500" />
                <span className="font-display font-semibold text-ink">Featured</span>
              </div>
              <div className="p-3 space-y-2">
                {ITEMS.filter((i) => i.starred).map((it) => (
                  <button
                    key={it.id}
                    onClick={() => setOpenId(it.id)}
                    className="w-full text-left flex items-center gap-3 rounded-lg p-2 hover:bg-forum-50/50 transition ring-1 ring-transparent hover:ring-paper-border"
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
              </div>
            </div>
          </aside>

          <section className="col-span-12 lg:col-span-9 space-y-4">
            {filtered.length === 0 ? (
              <div className="rounded-xl border border-paper-border bg-paper-raised p-10 text-center">
                <div className="h-14 w-14 mx-auto rounded-2xl bg-forum-50 ring-1 ring-forum-600/15 flex items-center justify-center text-forum-600 mb-3">
                  <Images className="h-6 w-6" />
                </div>
                <p className="font-display text-lg font-semibold text-ink">No media matches these filters</p>
                <p className="text-sm text-ink-subtle mt-1 max-w-lg mx-auto">
                  Try a different album or a broader keyword search.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearch('');
                      setAlbum('all');
                    }}
                  >
                    Reset filters
                  </Button>
                </div>
              </div>
            ) : view === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map((it) => (
                  <article
                    key={it.id}
                    className="rounded-xl border border-paper-border bg-paper-raised overflow-hidden group"
                  >
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
                              : IMG(
                                  it.title,
                                  it.aspect === 'portrait' ? 'portrait_4_3' : it.aspect === 'square' ? 'square' : 'landscape_16_9'
                                )
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
                              <Images className="h-2.5 w-2.5 mr-1" /> Photo
                            </>
                          ) : it.type === 'video' ? (
                            <>
                              <FileText className="h-2.5 w-2.5 mr-1" /> Video
                            </>
                          ) : (
                            <>
                              <FileText className="h-2.5 w-2.5 mr-1" /> Doc
                            </>
                          )}
                        </Badge>
                        {it.starred && (
                          <span className="h-7 w-7 rounded-full bg-brass-500 text-white shadow inline-flex items-center justify-center">
                            <Star className="h-3.5 w-3.5 fill-white" />
                          </span>
                        )}
                      </div>
                      {it.type === 'video' && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="h-12 w-12 rounded-full bg-black/45 backdrop-blur-sm ring-1 ring-white/25 flex items-center justify-center text-white">
                            <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current ml-0.5" aria-hidden>
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </button>
                    <div className="p-3.5 space-y-2.5">
                      <h3 className="text-sm font-semibold text-ink leading-snug line-clamp-2">{it.title}</h3>
                      <p className="text-xs text-ink-subtle line-clamp-2">{it.caption}</p>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-subtle">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {it.capturedAt}
                        </span>
                        <span className="h-1 w-1 rounded-full bg-paper-border mx-0.5" />
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {it.location.split(',')[0]}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {it.tags.slice(0, 3).map((t) => (
                          <span
                            key={t}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-forum-50 text-forum-700 border border-forum-600/20"
                          >
                            #{t}
                          </span>
                        ))}
                        {it.tags.length > 3 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-paper text-ink-subtle border border-paper-border">
                            +{it.tags.length - 3}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-paper-border/60">
                        <div className="text-[11px] text-ink-subtle inline-flex items-center gap-2">
                          <span className="inline-flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {it.views.toLocaleString()}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Download className="h-3 w-3" />
                            {it.downloads.toLocaleString()}
                          </span>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setOpenId(it.id)}>
                          <Eye className="h-3.5 w-3.5" /> View
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-paper-border bg-paper-raised divide-y divide-paper-border/60 overflow-hidden">
                {filtered.map((it) => (
                  <div key={it.id} className="flex flex-col sm:flex-row gap-3 p-3.5">
                    <button
                      onClick={() => setOpenId(it.id)}
                      className="sm:w-56 w-full h-36 sm:h-32 shrink-0 overflow-hidden rounded-lg ring-1 ring-paper-border bg-gradient-to-br from-forum-700 via-slateteal-600 to-brass-400"
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
                      </div>
                      <p className="text-xs text-ink-subtle line-clamp-2 mt-1">{it.caption}</p>
                      <div className="mt-auto pt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-subtle">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {it.capturedAt}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {it.location}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Tag className="h-3 w-3" /> {it.tags.slice(0, 3).join(' · ')}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Eye className="h-3 w-3" /> {it.views.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 pt-2 mt-1 border-t border-paper-border/60">
                        <Button variant="outline" size="sm" onClick={() => setOpenId(it.id)}>
                          <Eye className="h-3.5 w-3.5" /> Preview
                        </Button>
                        <Button variant="outline" size="sm">
                          <Download className="h-3.5 w-3.5" />
                          {it.sizeMB >= 100 ? `${(it.sizeMB / 1000).toFixed(1)} GB` : `${it.sizeMB.toFixed(0)} MB`}
                        </Button>
                        <button
                          className="ml-auto shrink-0 h-8 w-8 rounded-md border border-paper-border text-ink-subtle hover:text-forum-700 hover:border-forum-600/30 inline-flex items-center justify-center"
                          aria-label="More"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </Section>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-ink-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setOpenId(null)}
        >
          <div
            className="w-full sm:max-w-5xl max-h-[92vh] bg-paper rounded-t-2xl sm:rounded-2xl ring-1 shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 p-3.5 border-b border-paper-border/80">
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
                <button
                  className="h-8 w-8 rounded-md border border-paper-border text-ink-subtle hover:text-forum-700 hover:border-forum-600/30 inline-flex items-center justify-center"
                  aria-label="Share"
                >
                  <Share2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setOpenId(null)}
                  className="h-8 w-8 rounded-md border border-paper-border text-ink-subtle hover:text-forum-700 hover:border-forum-600/30 inline-flex items-center justify-center"
                  aria-label="Close preview"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-0 overflow-y-auto">
              <div className="md:col-span-3 bg-ink border-b md:border-b-0 md:border-r border-paper-border relative">
                <div className="min-h-[280px] md:min-h-[520px] flex items-center justify-center p-4">
                  {open.type === 'video' ? (
                    <div className="relative w-full max-h-[70vh] rounded-lg overflow-hidden aspect-video bg-black shadow-lg ring-1 ring-white/10">
                      <img
                        src={IMG(open.title + ', video still frame')}
                        alt=""
                        className="w-full h-full object-cover opacity-90"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-16 w-16 rounded-full bg-white/15 backdrop-blur-sm ring-1 ring-white/30 flex items-center justify-center text-white">
                          <svg viewBox="0 0 24 24" className="h-8 w-8 fill-current ml-1" aria-hidden>
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  ) : open.type === 'document' ? (
                    <div className="w-full max-h-[70vh] max-w-md bg-white rounded-lg shadow-xl ring-1 ring-paper-border p-8 flex flex-col items-start">
                      <div className="flex items-center gap-2 mb-4">
                        <FileText className="h-5 w-5 text-forum-700" />
                        <Badge variant="info" className="!text-[10px] !py-0">
                          PDF · {open.sizeMB.toFixed(1)} MB
                        </Badge>
                      </div>
                      <h4 className="font-display text-lg font-bold text-ink">{open.title}</h4>
                      <p className="text-xs text-ink-subtle mt-1">{open.creditLine} · {open.capturedAt}</p>
                      <div className="mt-5 space-y-2.5 w-full">
                        <div className="h-2 w-5/6 rounded bg-paper-border/70" />
                        <div className="h-2 w-full rounded bg-paper-border/50" />
                        <div className="h-2 w-full rounded bg-paper-border/50" />
                        <div className="h-2 w-4/6 rounded bg-paper-border/50" />
                      </div>
                    </div>
                  ) : (
                    <img
                      src={IMG(
                        open.title,
                        open.aspect === 'portrait' ? 'portrait_4_3' : open.aspect === 'square' ? 'square' : 'landscape_16_9'
                      )}
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
                    <p className="text-ink inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-ink-subtle" />{open.capturedAt}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-subtle mb-0.5">Location</p>
                    <p className="text-ink inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-ink-subtle" />{open.location}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-subtle mb-0.5">Credit</p>
                    <p className="text-ink">{open.creditLine}</p>
                  </div>
                  {open.resolution && (
                    <div className="col-span-2">
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-subtle mb-0.5">
                        Resolution / Duration
                      </p>
                      <p className="text-ink">{open.resolution}</p>
                    </div>
                  )}
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
                <div className="flex items-center justify-between text-xs border-y border-paper-border/60 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1 text-ink-subtle">
                      <Eye className="h-3.5 w-3.5" />
                      <span className="font-semibold text-ink">{open.views.toLocaleString()}</span> views
                    </span>
                    <span className="inline-flex items-center gap-1 text-ink-subtle">
                      <Download className="h-3.5 w-3.5" />
                      <span className="font-semibold text-ink">{open.downloads.toLocaleString()}</span> downloads
                    </span>
                  </div>
                  {open.starred && (
                    <span className="inline-flex items-center gap-1 text-ink-subtle">
                      <Star className="h-3.5 w-3.5 text-brass-500 fill-brass-500" /> Featured
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Button variant="primary" className="w-full">
                    <Download className="h-4 w-4" /> Download original
                  </Button>
                  <div className="grid grid-cols-3 gap-2">
                    <Button variant="outline" size="sm">
                      <Share2 className="h-3.5 w-3.5" /> Share
                    </Button>
                    <Link
                      to="/research"
                      className="inline-flex items-center justify-center gap-1 h-9 rounded-md border border-paper-border bg-paper px-3 text-xs font-medium text-ink-muted hover:bg-forum-50 hover:text-forum-700 transition-colors"
                    >
                      Research
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                    <Link
                      to="/events"
                      className="inline-flex items-center justify-center gap-1 h-9 rounded-md border border-paper-border bg-paper px-3 text-xs font-medium text-ink-muted hover:bg-forum-50 hover:text-forum-700 transition-colors"
                    >
                      <Calendar className="h-3.5 w-3.5" /> Events
                    </Link>
                  </div>
                  <p className="text-[11px] text-ink-subtle inline-flex items-start gap-1 pt-1">
                    <Info className="h-3 w-3 mt-0.5 shrink-0" />
                    Media is released under IFSMHP's Creative Commons BY-NC-SA 4.0 community licence — attribute the photographer when reusing outside the forum.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
