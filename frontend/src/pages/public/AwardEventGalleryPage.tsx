import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import AwardEventMediaGrid, { AWARD_EVENT_GALLERY_TITLE } from '../../components/awards/AwardEventMediaGrid';
import { CEREMONY_INFORMATION_PATH } from '../../domain/ceremonyRegistration';

export default function AwardEventGalleryPage() {
  useEffect(() => {
    const previous = document.title;
    document.title = 'Previous event gallery · IFSMHP Awards 2026';
    return () => { document.title = previous; };
  }, []);

  return (
    <section
      className="relative overflow-hidden bg-gradient-to-br from-forum-50 via-paper to-brass-50/70"
      aria-labelledby="award-event-gallery-heading"
    >
      <div
        className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-forum-200/40 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-16 bottom-10 h-64 w-64 rounded-full bg-brass-200/50 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative w-full px-3 pb-12 pt-6 sm:px-4 sm:pt-8 lg:px-5 lg:pb-16">
        <Link
          to={CEREMONY_INFORMATION_PATH}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-forum-700 hover:text-forum-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Award information
        </Link>
        <h1
          id="award-event-gallery-heading"
          className="mt-1 text-xl font-semibold tracking-tight text-forum-900 sm:text-2xl"
        >
          Previous event gallery
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-muted">
          Photographs and videos from the 2025 {AWARD_EVENT_GALLERY_TITLE}.
        </p>

        <div className="mt-5">
          <AwardEventMediaGrid mode="full" />
        </div>
      </div>
    </section>
  );
}
