import type { CeremonyProgramme } from '../../domain/ceremonyProgramme';
import CeremonyCommittee from './CeremonyCommittee';

function awardNumber(groups: CeremonyProgramme['groups'], groupIndex: number, awardIndex: number) {
  const earlier = groups.slice(0, groupIndex).reduce((sum, group) => sum + group.awards.length, 0);
  return earlier + awardIndex + 1;
}

export default function CeremonyAwardProgramme({ programme }: { programme: CeremonyProgramme }) {
  const groups = programme.groups.filter((group) => group.awards.length > 0);
  const divisions = programme.divisions.filter((division) => division.title.trim());
  const allocation = programme.allocation ?? [];
  const allocationTotal = allocation.reduce((sum, row) => ({
    categories: sum.categories + row.categories,
    senior: sum.senior + row.senior,
    midCareer: sum.midCareer + row.midCareer,
    young: sum.young + row.young,
    total: sum.total + row.total,
  }), { categories: 0, senior: 0, midCareer: 0, young: 0, total: 0 });
  const hasGroups = groups.length > 0;
  const hasDivisions = divisions.length > 0;

  return (
    <section id="commemorative-awards" aria-labelledby="commemorative-awards-heading" className="bg-paper-raised">
      <div className="mx-auto max-w-6xl px-4 pb-6 pt-8 sm:px-6 lg:pb-8 lg:pt-10">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center rounded-full bg-brass-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-brass-700 ring-1 ring-inset ring-brass-500/20">
              {programme.kicker || 'Ceremony programme'}
            </span>
            {programme.date && (
              <time className="text-sm font-medium text-forum-900">{programme.date}</time>
            )}
          </div>
          <h2 id="commemorative-awards-heading" className="mt-4 font-display text-3xl font-semibold tracking-tight text-forum-900 sm:text-4xl">
            {programme.title || 'Commemorative awards'}
          </h2>
          {programme.reference && <p className="mt-2 text-sm font-medium text-forum-900">{programme.reference}</p>}
          {programme.notice && <p className="mt-3 max-w-3xl text-base leading-relaxed text-ink-muted">{programme.notice}</p>}
          {!hasGroups && (
            <p className="mt-4 text-base leading-relaxed text-ink-muted">
              Award names will be listed here by discipline.
            </p>
          )}
        </div>

        {allocation.length > 0 && (
          <div className="mt-10 overflow-hidden rounded-2xl border border-paper-border bg-paper shadow-sm">
            <div className="border-b border-paper-border bg-forum-50 px-5 py-4 sm:px-6">
              <h3 className="font-display text-xl font-semibold text-forum-900 sm:text-2xl">Final allocation of 75 awards</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <caption className="sr-only">Award allocation by academic division and recipient level</caption>
                <thead className="bg-forum-900 text-xs uppercase tracking-wide text-white">
                  <tr>
                    <th className="px-4 py-3 font-medium" scope="col">Academic division</th>
                    <th className="px-4 py-3 text-right font-medium" scope="col">Categories</th>
                    <th className="px-4 py-3 text-right font-medium" scope="col">Senior</th>
                    <th className="px-4 py-3 text-right font-medium" scope="col">Mid-career</th>
                    <th className="px-4 py-3 text-right font-medium" scope="col">Young</th>
                    <th className="px-4 py-3 text-right font-medium" scope="col">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {allocation.map((row) => (
                    <tr key={row.division} className="border-t border-paper-border">
                      <th className="px-4 py-3 font-medium text-forum-900" scope="row">{row.division}</th>
                      <td className="px-4 py-3 text-right tabular-nums text-ink">{row.categories}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-ink">{row.senior}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-ink">{row.midCareer}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-ink">{row.young}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-forum-900">{row.total}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-forum-900 text-white">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold" scope="row">Total</th>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{allocationTotal.categories}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{allocationTotal.senior}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{allocationTotal.midCareer}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{allocationTotal.young}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-brass-500">{allocationTotal.total}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {programme.allocationNote && <p className="border-t border-paper-border px-5 py-4 text-sm leading-relaxed text-ink-muted sm:px-6">{programme.allocationNote}</p>}
          </div>
        )}

        {hasGroups ? (
          <div className="mt-10 space-y-8">
            {groups.map((group, groupIndex) => (
              <article key={`${group.label}-${group.title}`} className="overflow-hidden rounded-2xl border border-paper-border bg-paper shadow-sm">
                <header className="flex items-center gap-4 border-b border-paper-border bg-forum-50 px-5 py-4 sm:px-6">
                  <span className="font-display text-2xl font-semibold text-brass-600">{group.label}</span>
                  <h3 className="font-display text-xl font-semibold text-forum-900 sm:text-2xl">{group.title}</h3>
                </header>
                <ol>
                  {group.awards.map((award, awardIndex) => (
                    <li
                      key={`${award.name}-${award.discipline}`}
                      className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 gap-y-1 border-b border-paper-border px-5 py-4 last:border-b-0 sm:grid-cols-[3rem_minmax(0,1.15fr)_minmax(0,0.85fr)] sm:items-baseline sm:px-6"
                    >
                      <span className="font-display text-lg font-semibold tabular-nums text-brass-700">
                        {awardNumber(groups, groupIndex, awardIndex)}
                      </span>
                      <span className="font-medium text-forum-900">{award.name}</span>
                      <span className="col-start-2 text-sm leading-relaxed text-ink-muted sm:col-start-3 sm:text-right">{award.discipline}</span>
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-8 overflow-hidden rounded-2xl border border-paper-border bg-paper shadow-sm">
            <div className="hidden border-b border-paper-border bg-forum-50 px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-subtle sm:grid sm:grid-cols-[3rem_minmax(0,1.15fr)_minmax(0,0.85fr)]">
              <span>No.</span>
              <span>Award</span>
              <span className="text-right">Discipline</span>
            </div>
            <p className="px-5 py-10 text-sm leading-relaxed text-ink-muted sm:px-6">
              Discipline groups will appear here, with each award on its own numbered row.
            </p>
          </div>
        )}

        {programme.medals && programme.medals.length > 0 && (
          <div className="mt-12">
            <h3 className="font-display text-2xl font-semibold text-forum-900 sm:text-3xl">Special lifetime achievement gold medals</h3>
            <ul className="mt-6 grid gap-6 md:grid-cols-3">
              {programme.medals.map((medal) => (
                <li key={medal.name} className="rounded-2xl border border-paper-border bg-paper p-6 shadow-sm font-display text-xl font-semibold text-forum-900">{medal.name}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-12">
          <h3 className="font-display text-2xl font-semibold text-forum-900 sm:text-3xl">Recognition divisions</h3>
          {programme.divisionNote && (
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-ink-muted">{programme.divisionNote}</p>
          )}
          {hasDivisions ? (
            <ul className="mt-6 grid gap-6 md:grid-cols-3">
              {divisions.map((division) => (
                <li key={division.title} className="rounded-2xl border border-paper-border bg-paper p-6 shadow-sm">
                  {division.level && (
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass-700">{division.level}</p>
                  )}
                  {division.detail && (
                    <p className={`${division.level ? 'mt-2' : ''} font-display text-4xl font-semibold text-brass-600`}>{division.detail}</p>
                  )}
                  <h4 className={`${division.detail || division.level ? 'mt-3' : ''} font-display text-xl font-semibold text-forum-900`}>{division.title}</h4>
                  {division.description && <p className="mt-2 text-sm font-medium text-forum-900">{division.description}</p>}
                  {division.eligibility && <p className="mt-2 text-sm leading-relaxed text-ink-muted">{division.eligibility}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-ink-muted">
              The recognition divisions will sit side by side beneath the list.
            </p>
          )}
          {programme.totalLabel && (
            <p className="mt-6 text-sm font-medium uppercase tracking-[0.14em] text-forum-900">{programme.totalLabel}</p>
          )}
        </div>

        {programme.committee && programme.committee.length > 0 && (
          <CeremonyCommittee members={programme.committee} variant="footer" />
        )}
      </div>
    </section>
  );
}
