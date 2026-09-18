import GallerySection from '../../components/gallery/GallerySection';
import { Images, Info } from 'lucide-react';

export default function MemberGalleryPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-paper-border bg-gradient-to-br from-forum-50 via-white to-brass-50/60 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brass-700 inline-flex items-center gap-1.5">
              <Images className="h-3 w-3" /> Members · Community Archive
            </p>
            <h1 className="mt-2 font-display text-2xl sm:text-3xl font-semibold text-forum-900">
              IFSMHP Media Gallery
            </h1>
            <p className="mt-2 text-sm sm:text-[15px] text-ink-muted max-w-2xl leading-relaxed">
              Browse photographs from IFSMHP events, inductions, research
              showcases and awards ceremonies. New photographs are published
              here after each major event.
            </p>
          </div>
          <div className="inline-flex items-start gap-2 rounded-xl bg-white/70 ring-1 ring-forum-100 px-3.5 py-3 max-w-xs">
            <Info className="h-4 w-4 text-forum-600 mt-0.5 shrink-0" />
            <p className="text-xs leading-relaxed text-forum-800">
              Want a high-resolution copy of a photograph? Contact the Secretariat
              through your member messages.
            </p>
          </div>
        </div>
      </div>
      <GallerySection sectionId="member-gallery-view" />
    </div>
  );
}
