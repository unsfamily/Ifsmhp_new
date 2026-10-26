import type { CeremonyProgramme } from '../../domain/ceremonyProgramme';

function awardNumber(groups: CeremonyProgramme['groups'], groupIndex: number, awardIndex: number) {
  const earlier = groups.slice(0, groupIndex).reduce((sum, group) => sum + group.awards.length, 0);
  return earlier + awardIndex + 1;
}

export default function CeremonyAwardProgramme({ programme }: { programme: CeremonyProgramme }) {
  const groups = programme.groups.filter((group) => group.awards.length > 0);
  const divisions = programme.divisions.filter((division) => division.title.trim());
  const hasGroups = groups.length > 0;
  const hasDivisions = divisions.length > 0;

  return (
    <section id="commemorative-awards" aria-labelledby="commemorative-awards-heading" className="bg-paper-raised">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center rounded-full bg-brass-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-brass-700 ring-1 ring-inset ring-brass-500/20">
              {programme.kicker || 'Ceremony programme'}
            </span>
            {programme.date && (
              <time className="text-sm font-medium text-forum-900">{programme.date}</time>
            )}
          </div>
          <h2 id="commemorative-awards-heading" className="mt-5 font-display text-3xl font-semibold tracking-tight text-forum-900 sm:text-4xl">
            {programme.title || 'Commemorative awards'}
          </h2>
          {!hasGroups && (
            <p className="mt-4 text-base leading-relaxed text-ink-muted">
              Award names will be listed here by discipline.
            </p>
          )}
        </div>

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
                  {division.detail && (
                    <p className="font-display text-4xl font-semibold text-brass-600">{division.detail}</p>
                  )}
                  <h4 className={`${division.detail ? 'mt-3' : ''} font-display text-xl font-semibold text-forum-900`}>{division.title}</h4>
                  {division.description && <p className="mt-2 text-sm leading-relaxed text-ink-muted">{division.description}</p>}
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

        {programme.attribution && (
          <footer className="mt-12 border-t border-paper-border pt-6">
            <p className="font-display text-lg font-semibold text-forum-900">{programme.attribution.name}</p>
            <p className="mt-1 text-sm text-ink-muted">{programme.attribution.role}</p>
            <p className="text-sm text-ink-muted">{programme.attribution.organisation}</p>
          </footer>
        )}
      </div>
    </section>
  );
}
