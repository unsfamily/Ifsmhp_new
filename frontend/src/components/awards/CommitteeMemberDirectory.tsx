import { useDeferredValue, useMemo, useState } from 'react';
import { Search, UserRoundCheck, UserRoundX } from 'lucide-react';
import {
  buildCommitteeDirectory,
  filterCommitteeDirectory,
  type CommitteeDirectoryEntry,
} from '../../domain/maharashtraChapter';
import type { CeremonyCommitteeMember } from '../../domain/ceremonyProgramme';

function StatusBadge({ status }: { status: CommitteeDirectoryEntry['status'] }) {
  if (status === 'confirmed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slateteal-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slateteal-800">
        <UserRoundCheck className="h-3.5 w-3.5" aria-hidden="true" />
        Listed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brass-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-brass-800">
      Proposed seat
    </span>
  );
}

export default function CommitteeMemberDirectory({
  organisingCommittee = [],
}: {
  organisingCommittee?: CeremonyCommitteeMember[];
}) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const directory = useMemo(() => buildCommitteeDirectory(organisingCommittee), [organisingCommittee]);
  const searching = deferredQuery.trim().length > 0;
  const results = useMemo(() => {
    const matched = filterCommitteeDirectory(directory, deferredQuery);
    if (searching) return matched;
    return matched.filter((entry) => entry.status === 'confirmed' && entry.name !== 'Appointment pending');
  }, [deferredQuery, directory, searching]);
  const confirmedMatches = results.filter((entry) => entry.status === 'confirmed' && entry.name !== 'Appointment pending');
  const proposedCount = directory.filter((entry) => entry.status === 'proposed').length;

  return (
    <section aria-labelledby="committee-directory-heading" className="border-t border-paper-border bg-paper">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-12">
        <div className="max-w-3xl">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-brass-700">Member directory</p>
          <h2 id="committee-directory-heading" className="mt-3 font-display text-3xl font-semibold text-forum-900 sm:text-4xl">
            Search the committee list
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-muted sm:text-[16px]">
            Look up a person by name to confirm whether they appear on the organising committee or Maharashtra chapter roster.
            Open seats remain searchable as proposed appointments until a name is confirmed.
          </p>
        </div>

        <div className="mt-8 max-w-xl">
          <label htmlFor="committee-member-search" className="text-sm font-medium text-forum-900">
            Search by name or role
          </label>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
            <input
              id="committee-member-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="e.g. Hemachandran, Research Secretary"
              autoComplete="off"
              className="w-full rounded-xl border border-paper-border bg-paper-raised py-3 pl-10 pr-4 text-[15px] text-forum-900 shadow-sm outline-none ring-brass-500/30 placeholder:text-ink-subtle focus:border-brass-500 focus:ring-2"
            />
          </div>
          <p className="mt-2 text-[13px] text-ink-muted" aria-live="polite">
            {searching
              ? `${results.length} match${results.length === 1 ? '' : 'es'} · ${confirmedMatches.length} named listing${confirmedMatches.length === 1 ? '' : 's'}`
              : `${results.length} confirmed listing${results.length === 1 ? '' : 's'} · ${proposedCount} proposed seats searchable by role`}
          </p>
        </div>

        {searching && results.length === 0 ? (
          <div className="mt-8 flex max-w-xl items-start gap-3 rounded-2xl border border-paper-border bg-paper-raised px-5 py-4">
            <UserRoundX className="mt-0.5 h-5 w-5 shrink-0 text-brass-700" aria-hidden="true" />
            <div>
              <p className="font-medium text-forum-900">Not listed</p>
              <p className="mt-1 text-[15px] leading-relaxed text-ink-muted">
                No committee member or chapter seat matches “{deferredQuery.trim()}”.
              </p>
            </div>
          </div>
        ) : (
          <ul className="mt-8 divide-y divide-paper-border overflow-hidden rounded-2xl border border-paper-border bg-paper-raised">
            {results.map((entry) => (
              <li key={entry.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-display text-lg font-semibold text-forum-900">{entry.name}</p>
                  <p className="mt-1 text-[15px] text-ink-muted">{entry.role}</p>
                  <p className="mt-0.5 text-[13px] text-ink-subtle">{entry.chapter}</p>
                </div>
                <StatusBadge status={entry.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
