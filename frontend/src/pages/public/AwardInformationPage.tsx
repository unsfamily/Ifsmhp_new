import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Button from '../../components/common/Button';
import CeremonyAwardProgramme from '../../components/awards/CeremonyAwardProgramme';
import CeremonyCommittee from '../../components/awards/CeremonyCommittee';
import PreviousAwardPhotos from '../../components/awards/PreviousAwardPhotos';
import { CEREMONY_EVENT_DATE, CEREMONY_VENUE, ceremonyProgramme } from '../../domain/ceremonyProgramme';
import { CEREMONY_NOMINATE_PATH, CEREMONY_PAGE_PATH } from '../../domain/ceremonyRegistration';

export default function AwardInformationPage() {
  useEffect(() => {
    const previous = document.title;
    document.title = 'Award information · IFSMHP Awards 2026';
    return () => { document.title = previous; };
  }, []);

  return (
    <>
      <section className="border-b border-paper-border bg-paper" aria-labelledby="award-information-heading">
        <div className="mx-auto grid max-w-6xl items-start gap-8 px-4 pb-10 pt-12 sm:px-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)] lg:gap-12 lg:pb-12 lg:pt-14">
          <div>
            <Link to={CEREMONY_PAGE_PATH} className="inline-flex items-center gap-1.5 text-[15px] font-medium text-forum-700 hover:text-forum-900">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Second International Awards Ceremony
            </Link>
            <h1 id="award-information-heading" className="mt-5 max-w-3xl font-display text-4xl font-semibold leading-[0.98] tracking-tight text-forum-900 sm:text-5xl">
              <span className="block">
                <span className="mr-[0.16em] inline-flex items-start align-baseline text-[1.32em] leading-none text-brass-600" aria-hidden="true">
                  <span>2</span>
                  <span className="ml-[0.2em] mt-[0.6em] text-[0.40em] font-semibold leading-none">nd</span>
                </span>
                <span className="sr-only">Second</span>
                {' '}International
              </span>
              <span className="mt-[0.08em] block">IFSMHP Awards 2026</span>
            </h1>
            <p className="mt-4 max-w-3xl text-[17px] leading-relaxed text-ink-muted sm:text-[19px]">
              {ceremonyProgramme.totalLabel}. The ceremony is on {CEREMONY_EVENT_DATE} at {CEREMONY_VENUE}, Pune.
            </p>
            <div className="mt-6">
              <Button as="link" to={CEREMONY_NOMINATE_PATH} size="lg">Submit a nomination</Button>
            </div>
          </div>

          <aside className="rounded-2xl border border-paper-border bg-gradient-to-br from-forum-50 to-paper p-5 shadow-sm sm:p-6" aria-labelledby="honours-heading">
            <h2 id="honours-heading" className="font-display text-2xl font-semibold text-forum-900 sm:text-3xl">What these honours recognise</h2>
            <ul className="mt-4 space-y-2.5 text-[15px] leading-relaxed text-ink">
              {ceremonyProgramme.divisions.map((division) => (
                <li key={division.title} className="rounded-lg bg-white/80 px-4 py-2.5 ring-1 ring-paper-border">
                  {division.level}: {division.title} — {division.description}.
                </li>
              ))}
              <li className="rounded-lg bg-white/80 px-4 py-2.5 ring-1 ring-paper-border">Nomination does not guarantee selection and is subject to independent review.</li>
            </ul>
          </aside>
        </div>
      </section>

      {ceremonyProgramme.committee && ceremonyProgramme.committee.length > 0 && (
        <CeremonyCommittee members={ceremonyProgramme.committee} />
      )}

      <CeremonyAwardProgramme programme={ceremonyProgramme} />

      <section className="border-t border-paper-border bg-paper" aria-labelledby="eligibility-heading">
        <div className="mx-auto max-w-6xl px-4 pb-8 pt-6 sm:px-6 lg:pb-10 lg:pt-8">
          <h2 id="eligibility-heading" className="font-display text-3xl font-semibold text-forum-900">Eligibility and nomination</h2>
          {ceremonyProgramme.eligibilityIntro && <p className="mt-4 max-w-3xl text-[17px] leading-relaxed text-ink-muted">{ceremonyProgramme.eligibilityIntro}</p>}
          {ceremonyProgramme.eligibilityRules && ceremonyProgramme.eligibilityRules.length > 0 && (
            <ul className="mt-6 max-w-3xl space-y-3">
              {ceremonyProgramme.eligibilityRules.map((rule) => (
                <li key={rule.title} className="rounded-2xl border border-paper-border bg-paper-raised px-5 py-4">
                  <h3 className="text-[15px] font-medium text-forum-900">{rule.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">{rule.detail}</p>
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
                    <h4 className="text-[15px] font-medium text-forum-900">{rule.field}</h4>
                    <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">{rule.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-10 grid gap-8 lg:grid-cols-2">
            {ceremonyProgramme.nominationDocuments && (
              <article className="rounded-2xl border border-paper-border bg-paper-raised p-6">
                <h3 className="font-display text-2xl font-semibold text-forum-900">Nomination documents</h3>
                <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink-muted">
                  {ceremonyProgramme.nominationDocuments.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </article>
            )}
            {ceremonyProgramme.evaluation && (
              <article className="rounded-2xl border border-paper-border bg-paper-raised p-6">
                <h3 className="font-display text-2xl font-semibold text-forum-900">Evaluation</h3>
                <table className="mt-4 w-full text-left text-[15px]">
                  <caption className="sr-only">Evaluation marks for award nominations</caption>
                  <thead>
                    <tr className="border-b border-paper-border text-[13px] uppercase tracking-wide text-ink-subtle">
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
                {ceremonyProgramme.qualifyingScores && <p className="mt-4 text-[15px] leading-relaxed text-ink-muted">{ceremonyProgramme.qualifyingScores}</p>}
              </article>
            )}
          </div>
          {ceremonyProgramme.selectionNote && <p className="mt-6 max-w-3xl text-[15px] leading-relaxed text-ink-muted">{ceremonyProgramme.selectionNote}</p>}
        </div>
      </section>

      <section className="bg-paper" aria-labelledby="previous-photographs-heading">
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-4 sm:px-6 lg:pb-20 lg:pt-6">
          <h2 id="previous-photographs-heading" className="font-display text-3xl font-semibold text-forum-900">Previous event photographs</h2>
          <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-ink-muted">
            Photographs from the 2025 International Laureates Recognition Conclave.
          </p>
          <div className="mt-8">
            <PreviousAwardPhotos />
          </div>
        </div>
      </section>
    </>
  );
}
