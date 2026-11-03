import { useState, type FormEvent } from 'react';
import { Search, UserRoundCheck, UserRoundX } from 'lucide-react';
import { publicApi, type PublicMemberListing } from '../../api/public';
import { normalizeError } from '../../api/client';

export default function MemberListingLookup() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<PublicMemberListing | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const name = query.trim();
    if (name.length < 2) {
      setResult(null);
      setError('Enter at least 2 characters of a name or member ID.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      setResult(await publicApi.memberListing(name));
    } catch (caught) {
      setResult(null);
      setError(normalizeError(caught).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="member-directory" aria-labelledby="member-directory-heading" className="border-t border-paper-border bg-paper">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="max-w-3xl">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-brass-700">Member directory</p>
          <h2 id="member-directory-heading" className="mt-3 font-display text-3xl font-semibold text-forum-900 sm:text-4xl">
            Check whether a member is listed
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-muted sm:text-[16px]">
            Search an approved member by name or member ID. A listing confirms they hold an IFSMHP member ID. Pending applications are not shown.
          </p>
        </div>

        <form onSubmit={(event) => { void onSubmit(event); }} className="mt-8 max-w-xl">
          <label htmlFor="public-member-search" className="text-sm font-medium text-forum-900">Name or member ID</label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
              <input
                id="public-member-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="e.g. Anita Rao or IFSMHP-000003"
                autoComplete="off"
                className="w-full rounded-xl border border-paper-border bg-paper-raised py-3 pl-10 pr-4 text-[15px] text-forum-900 shadow-sm outline-none ring-brass-500/30 placeholder:text-ink-subtle focus:border-brass-500 focus:ring-2"
              />
            </div>
            <button type="submit" disabled={busy} className="rounded-xl bg-forum-800 px-5 py-3 text-sm font-semibold text-white hover:bg-forum-900 disabled:opacity-60">
              {busy ? 'Searching…' : 'Search'}
            </button>
          </div>
          {error && <p role="alert" className="mt-2 text-sm text-danger-600">{error}</p>}
        </form>

        {result && !result.listed && (
          <div className="mt-8 flex max-w-xl items-start gap-3 rounded-2xl border border-paper-border bg-paper-raised px-5 py-4">
            <UserRoundX className="mt-0.5 h-5 w-5 shrink-0 text-brass-700" aria-hidden="true" />
            <div>
              <p className="font-medium text-forum-900">Not listed</p>
              <p className="mt-1 text-[15px] leading-relaxed text-ink-muted">No approved member matches “{result.query}”.</p>
            </div>
          </div>
        )}

        {result && result.listed && (
          <ul className="mt-8 divide-y divide-paper-border overflow-hidden rounded-2xl border border-paper-border bg-paper-raised">
            {result.items.map((member) => (
              <li key={member.memberId} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-display text-lg font-semibold text-forum-900">{member.name}</p>
                  <p className="mt-1 text-[15px] text-ink-muted">{member.professionalType}{member.institution ? ` · ${member.institution}` : ''}</p>
                  {member.country && <p className="mt-0.5 text-[13px] text-ink-subtle">{member.country}</p>}
                </div>
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slateteal-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slateteal-800">
                    <UserRoundCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    Listed
                  </span>
                  <code className="text-[12px] font-semibold text-forum-800">{member.memberId}</code>
                </div>
              </li>
            ))}
          </ul>
        )}
        {result?.truncated && <p className="mt-3 max-w-xl text-[13px] text-ink-muted">Showing the first 20 matches. Add more of the name or the member ID to narrow the list.</p>}
      </div>
    </section>
  );
}
