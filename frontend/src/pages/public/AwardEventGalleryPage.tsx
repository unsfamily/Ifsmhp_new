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
    <section className="bg-paper" aria-labelledby="award-event-gallery-heading">
      <div className="mx-auto max-w-6xl px-4 pb-8 pt-12 sm:px-6 lg:pt-14">
        <Link to={CEREMONY_INFORMATION_PATH} className="inline-flex items-center gap-1.5 text-[15px] font-medium text-forum-700 hover:text-forum-900">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Award information
        </Link>
        <h1 id="award-event-gallery-heading" className="mt-5 font-display text-4xl font-semibold tracking-tight text-forum-900 sm:text-5xl">
          Previous event gallery
        </h1>
        <p className="mt-4 max-w-3xl text-[17px] leading-relaxed text-ink-muted">
          Photographs and videos from the 2025 {AWARD_EVENT_GALLERY_TITLE}.
        </p>
      </div>

      <div className="w-full px-2 pb-12 sm:px-3 lg:px-4 lg:pb-16">
        <AwardEventMediaGrid mode="full" />
      </div>
    </section>
  );
}
