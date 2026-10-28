import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MapPin } from 'lucide-react';
import Button from '../../components/common/Button';
import CeremonyAwardProgramme from '../../components/awards/CeremonyAwardProgramme';
import CeremonyCommittee from '../../components/awards/CeremonyCommittee';
import GalleryMedia from '../../components/gallery/GalleryMedia';
import { apiClient } from '../../api/client';
import { CEREMONY_ADDRESS, CEREMONY_EVENT_DATE, CEREMONY_VENUE, ceremonyProgramme } from '../../domain/ceremonyProgramme';
import { CEREMONY_NOMINATE_PATH, CEREMONY_PAGE_PATH } from '../../domain/ceremonyRegistration';

type GalleryPhoto = {
  id: string;
  title: string;
  caption: string;
  altText: string;
  imageUrl: string;
  mediaUrl?: string;
  type?: 'image' | 'video';
  categoryId: string;
  displayOrder: number;
};

type GalleryCategory = { id: string; name: string; displayOrder: number };

export default function AwardInformationPage() {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [categories, setCategories] = useState<GalleryCategory[]>([]);
  const [galleryError, setGalleryError] = useState('');

  useEffect(() => {
    const previous = document.title;
    document.title = 'Award information · IFSMHP Awards 2026';
    return () => { document.title = previous; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      apiClient.get<{ data: { items: GalleryCategory[] } }>('/public/gallery/categories', { params: { limit: 50 }, signal: controller.signal }),
      apiClient.get<{ data: { items: GalleryPhoto[] } }>('/public/gallery/photos', { params: { limit: 24 }, signal: controller.signal }),
    ]).then(([categoryResponse, photoResponse]) => {
      setCategories(categoryResponse.data.data.items);
      setPhotos(photoResponse.data.data.items);
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setGalleryError(error instanceof Error ? error.message : 'Previous ceremony photographs could not be loaded.');
    });
    return () => controller.abort();
  }, []);

  const categoryOrder = new Map(categories.map((category) => [category.id, category.displayOrder]));
  const categoryName = new Map(categories.map((category) => [category.id, category.name]));
  const orderedPhotos = [...photos].sort((a, b) => (categoryOrder.get(a.categoryId) ?? 0) - (categoryOrder.get(b.categoryId) ?? 0) || a.displayOrder - b.displayOrder || a.title.localeCompare(b.title));

  return (
    <>
      <section className="border-b border-paper-border bg-paper" aria-labelledby="award-information-heading">
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-12 sm:px-6 lg:pb-12 lg:pt-14">
          <Link to={CEREMONY_PAGE_PATH} className="inline-flex items-center gap-1.5 text-sm font-medium text-forum-700 hover:text-forum-900">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Second International Awards Ceremony
          </Link>
          <h1 id="award-information-heading" className="mt-5 max-w-3xl font-display text-4xl font-semibold tracking-tight text-forum-900 sm:text-5xl">
            2nd International IFSMHP Awards 2026
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-ink-muted sm:text-lg">
            {ceremonyProgramme.totalLabel}. The ceremony is on {CEREMONY_EVENT_DATE} at {CEREMONY_VENUE}, Pune.
          </p>
          <div className="mt-6">
            <Button as="link" to={CEREMONY_NOMINATE_PATH} size="lg">Submit a nomination</Button>
          </div>
        </div>
      </section>

      <section className="bg-paper" aria-labelledby="venue-heading">
        <div className="mx-auto grid max-w-6xl items-start gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:py-12">
          <article className="rounded-2xl border border-paper-border bg-paper-raised p-5 shadow-sm sm:p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-forum-600 text-white">
              <MapPin className="h-5 w-5" aria-hidden="true" />
            </div>
            <h2 id="venue-heading" className="mt-4 font-display text-2xl font-semibold text-forum-900 sm:text-3xl">Venue</h2>
            <p className="mt-3 font-medium text-forum-900">{CEREMONY_VENUE}</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{CEREMONY_ADDRESS}</p>
            <p className="mt-3 text-sm font-medium text-forum-900">{CEREMONY_EVENT_DATE}</p>
          </article>
          <article className="rounded-2xl border border-paper-border bg-gradient-to-br from-forum-50 to-paper p-5 shadow-sm sm:p-6">
            <h2 className="font-display text-2xl font-semibold text-forum-900 sm:text-3xl">What these honours recognise</h2>
            <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-ink">
              {ceremonyProgramme.divisions.map((division) => (
                <li key={division.title} className="rounded-lg bg-white/80 px-4 py-2.5 ring-1 ring-paper-border">
                  {division.level}: {division.title} — {division.description}.
                </li>
              ))}
              <li className="rounded-lg bg-white/80 px-4 py-2.5 ring-1 ring-paper-border">Nomination does not guarantee selection and is subject to independent review.</li>
            </ul>
          </article>
        </div>
      </section>

      {ceremonyProgramme.committee && ceremonyProgramme.committee.length > 0 && (
        <CeremonyCommittee members={ceremonyProgramme.committee} />
      )}

      <CeremonyAwardProgramme programme={ceremonyProgramme} />

      <section className="border-t border-paper-border bg-paper" aria-labelledby="eligibility-heading">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <h2 id="eligibility-heading" className="font-display text-3xl font-semibold text-forum-900">Eligibility and nomination</h2>
          {ceremonyProgramme.eligibilityIntro && <p className="mt-4 max-w-3xl text-base leading-relaxed text-ink-muted">{ceremonyProgramme.eligibilityIntro}</p>}
          {ceremonyProgramme.eligibilityRules && ceremonyProgramme.eligibilityRules.length > 0 && (
            <ul className="mt-6 max-w-3xl space-y-3">
              {ceremonyProgramme.eligibilityRules.map((rule) => (
                <li key={rule.title} className="rounded-2xl border border-paper-border bg-paper-raised px-5 py-4">
                  <h3 className="font-medium text-forum-900">{rule.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">{rule.detail}</p>
                </li>
              ))}
            </ul>
          )}
          {ceremonyProgramme.contributionRules && ceremonyProgramme.contributionRules.length > 0 && (
            <div className="mt-10">
              <h3 className="font-display text-2xl font-semibold text-forum-900">Qualifying contributions</h3>
              <ul className="mt-5 grid gap-4 md:grid-cols-2">
                {ceremonyProgramme.contributionRules.map((rule) => (
                  <li key={rule.field} className="rounded-2xl border border-paper-border bg-paper px-5 py-4">
                    <h4 className="font-medium text-forum-900">{rule.field}</h4>
                    <p className="mt-2 text-sm leading-relaxed text-ink-muted">{rule.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-10 grid gap-8 lg:grid-cols-2">
            {ceremonyProgramme.nominationDocuments && (
              <article className="rounded-2xl border border-paper-border bg-paper-raised p-6">
                <h3 className="font-display text-2xl font-semibold text-forum-900">Nomination documents</h3>
                <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-ink-muted">
                  {ceremonyProgramme.nominationDocuments.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </article>
            )}
            {ceremonyProgramme.evaluation && (
              <article className="rounded-2xl border border-paper-border bg-paper-raised p-6">
                <h3 className="font-display text-2xl font-semibold text-forum-900">Evaluation</h3>
                <table className="mt-4 w-full text-left text-sm">
                  <caption className="sr-only">Evaluation marks for award nominations</caption>
                  <thead>
                    <tr className="border-b border-paper-border text-xs uppercase tracking-wide text-ink-subtle">
                      <th className="py-2 font-medium" scope="col">Parameter</th>
                      <th className="py-2 text-right font-medium" scope="col">Marks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ceremonyProgramme.evaluation.map((row) => (
                      <tr key={row.parameter} className="border-b border-paper-border">
                        <th className="py-2 pr-4 font-medium text-forum-900" scope="row">{row.parameter}</th>
                        <td className="py-2 text-right tabular-nums text-ink">{row.marks}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th className="py-2 text-left font-semibold text-forum-900" scope="row">Total</th>
                      <td className="py-2 text-right font-semibold tabular-nums text-forum-900">{ceremonyProgramme.evaluation.reduce((sum, row) => sum + row.marks, 0)}</td>
                    </tr>
                  </tfoot>
                </table>
                {ceremonyProgramme.qualifyingScores && <p className="mt-4 text-sm leading-relaxed text-ink-muted">{ceremonyProgramme.qualifyingScores}</p>}
              </article>
            )}
          </div>
          {ceremonyProgramme.selectionNote && <p className="mt-8 max-w-3xl text-sm leading-relaxed text-ink-muted">{ceremonyProgramme.selectionNote}</p>}
        </div>
      </section>

      <section className="bg-paper" aria-labelledby="previous-photographs-heading">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <h2 id="previous-photographs-heading" className="font-display text-3xl font-semibold text-forum-900">Previous event photographs</h2>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-ink-muted">
            Published gallery photographs, in category order, with their captions.
          </p>
          {galleryError && <p role="alert" className="mt-6 text-sm text-danger-600">{galleryError}</p>}
          {!galleryError && orderedPhotos.length === 0 && <p className="mt-6 text-sm text-ink-muted">Photographs from previous IFSMHP events will appear here when they are published in the gallery.</p>}
          {orderedPhotos.length > 0 && (
            <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {orderedPhotos.map((photo) => (
                <li key={photo.id} className="overflow-hidden rounded-2xl border border-paper-border bg-paper-raised shadow-sm">
                  <GalleryMedia src={photo.mediaUrl || photo.imageUrl} mediaType={photo.type ?? 'image'} alt={photo.altText || photo.caption || photo.title} className="aspect-[4/3] w-full object-cover" />
                  <div className="p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brass-700">{categoryName.get(photo.categoryId) || 'Event'}</p>
                    <h3 className="mt-2 font-medium text-forum-900">{photo.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-muted">{photo.caption || 'No caption has been added for this photograph.'}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
