import { useEffect, useState, type FormEvent } from 'react';
import { ChevronLeft, ChevronRight, Search, UserRoundX } from 'lucide-react';
import { publicApi, type PublicMember } from '../../api/public';
import { normalizeError } from '../../api/client';

const PAGE_SIZE = 10;

function pageWindow(current: number, totalPages: number) {
  const wanted = [1, totalPages, current - 1, current, current + 1];
  return [...new Set(wanted.filter((page) => page >= 1 && page <= totalPages))].sort((left, right) => left - right);
}

export default function MemberListingLookup() {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [members, setMembers] = useState<PublicMember[]>([]);
  const [directoryState, setDirectoryState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [directoryError, setDirectoryError] = useState('');
  const [retryToken, setRetryToken] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const loadDirectory = async (background: boolean) => {
      if (!background) {
        setDirectoryState('loading');
        setDirectoryError('');
      }
      try {
        const data = await publicApi.memberDirectory({
          page,
          limit: PAGE_SIZE,
          ...(submittedQuery ? { q: submittedQuery } : {}),
        }, controller.signal);
        if (cancelled) return;
        setMembers(data.items);
        setPages(data.pagination.pages);
        setTotal(data.pagination.total);
        setDirectoryState('ready');
      } catch (caught) {
        if (cancelled || controller.signal.aborted) return;
        if (background) return;
        setMembers([]);
        setTotal(0);
        setPages(1);
        setDirectoryError(normalizeError(caught).message);
        setDirectoryState('error');
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') void loadDirectory(true);
    };

    void loadDirectory(false);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      controller.abort();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [page, submittedQuery, retryToken]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const name = query.trim();
    if (name.length === 0) {
      setSubmittedQuery('');
      setPage(1);
      setError('');
      return;
    }
    if (name.length < 2) {
      setError('Enter at least 2 characters of a name or member ID.');
      return;
    }
    setError('');
    setPage(1);
    setSubmittedQuery(name);
  };

  const showAllMembers = () => {
    setQuery('');
    setSubmittedQuery('');
    setPage(1);
    setError('');
  };

  const goToPage = (next: number) => {
    setPage(next);
    document.getElementById('member-directory')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const showingSearch = submittedQuery.length > 0;
  const notListed = showingSearch && directoryState === 'ready' && total === 0;
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);
  const visiblePages = pageWindow(page, pages);

  return (
    <section id="member-directory" aria-labelledby="member-directory-heading" className="border-t border-paper-border bg-paper">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="max-w-3xl">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-brass-700">Member directory</p>
          <h2 id="member-directory-heading" className="mt-3 font-display text-3xl font-semibold text-forum-900 sm:text-4xl">
            Check whether a member is listed
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-muted sm:text-[16px]">
            Approved members are listed below by member ID, name, and designation. Search by name or member ID to narrow the list. Pending applications are not shown. A newly approved member appears the next time this page is opened, or when you return to this tab.
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-8 max-w-xl">
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
            <button type="submit" disabled={directoryState === 'loading'} className="rounded-xl bg-forum-800 px-5 py-3 text-sm font-semibold text-white hover:bg-forum-900 disabled:opacity-60">
              {directoryState === 'loading' && showingSearch ? 'Searching…' : 'Search'}
            </button>
          </div>
          {error && <p role="alert" className="mt-2 text-sm text-danger-600">{error}</p>}
        </form>

        {notListed && (
          <div className="mt-8 flex max-w-xl items-start gap-3 rounded-2xl border border-paper-border bg-paper-raised px-5 py-4">
            <UserRoundX className="mt-0.5 h-5 w-5 shrink-0 text-brass-700" aria-hidden="true" />
            <div>
              <p className="font-medium text-forum-900">Not listed</p>
              <p className="mt-1 text-[15px] leading-relaxed text-ink-muted">No approved member matches “{submittedQuery}”.</p>
              <button type="button" onClick={showAllMembers} className="mt-3 text-sm font-semibold text-forum-800 underline-offset-2 hover:underline">
                Show all members
              </button>
            </div>
          </div>
        )}

        {directoryState === 'error' && (
          <div role="alert" className="mt-8 max-w-xl rounded-2xl border border-paper-border bg-paper-raised px-5 py-4">
            <p className="font-medium text-forum-900">The member directory could not be loaded</p>
            <p className="mt-1 text-[15px] leading-relaxed text-ink-muted">{directoryError}</p>
            <button
              type="button"
              onClick={() => setRetryToken((token) => token + 1)}
              className="mt-3 text-sm font-semibold text-forum-800 underline-offset-2 hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {directoryState === 'loading' && (
          <p className="mt-8 text-[15px] text-ink-muted" role="status">Loading registered members…</p>
        )}

        {directoryState === 'ready' && !showingSearch && total === 0 && (
          <p className="mt-8 text-[15px] text-ink-muted">No approved members are listed yet.</p>
        )}

        {directoryState === 'ready' && members.length > 0 && (
          <div className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-ink-muted">
                {showingSearch
                  ? `${total} matching ${total === 1 ? 'member' : 'members'}`
                  : `${total} approved ${total === 1 ? 'member' : 'members'}`}
                {total > PAGE_SIZE ? ` · ${rangeStart}–${rangeEnd}` : ''}
              </p>
              {showingSearch && (
                <button type="button" onClick={showAllMembers} className="text-sm font-semibold text-forum-800 underline-offset-2 hover:underline">
                  Show all members
                </button>
              )}
            </div>
            <div className="mt-3 overflow-x-auto rounded-2xl border border-paper-border bg-paper-raised">
              <table className="min-w-full text-left">
                <caption className="sr-only">Approved IFSMHP members by member ID, name, and designation</caption>
                <thead className="bg-forum-50/80 text-[12px] font-semibold uppercase tracking-wide text-ink-subtle">
                  <tr>
                    <th scope="col" className="whitespace-nowrap px-5 py-3">Member ID</th>
                    <th scope="col" className="px-5 py-3">Name</th>
                    <th scope="col" className="px-5 py-3">Designation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-paper-border">
                  {members.map((member) => (
                    <tr key={member.memberId} className="text-[15px]">
                      <td className="whitespace-nowrap px-5 py-3.5">
                        <code className="text-[13px] font-semibold text-forum-800">{member.memberId}</code>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-forum-900">{member.name}</td>
                      <td className="px-5 py-3.5 text-ink-muted">{member.designation || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <nav aria-label="Member directory pages" className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => goToPage(page - 1)}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-1 rounded-lg border border-paper-border bg-paper-raised px-3 py-2 text-sm font-medium text-forum-800 hover:bg-forum-50 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  Previous
                </button>
                {visiblePages.map((pageNumber, index) => {
                  const previous = visiblePages[index - 1];
                  return (
                    <span key={pageNumber} className="inline-flex items-center gap-2">
                      {previous !== undefined && pageNumber - previous > 1 && <span className="px-1 text-ink-subtle" aria-hidden="true">…</span>}
                      <button
                        type="button"
                        onClick={() => goToPage(pageNumber)}
                        aria-current={pageNumber === page ? 'page' : undefined}
                        className={`min-w-9 rounded-lg px-3 py-2 text-sm font-semibold ${
                          pageNumber === page
                            ? 'bg-forum-800 text-white'
                            : 'border border-paper-border bg-paper-raised text-forum-800 hover:bg-forum-50'
                        }`}
                      >
                        {pageNumber}
                      </button>
                    </span>
                  );
                })}
                <button
                  type="button"
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= pages}
                  className="inline-flex items-center gap-1 rounded-lg border border-paper-border bg-paper-raised px-3 py-2 text-sm font-medium text-forum-800 hover:bg-forum-50 disabled:opacity-40"
                >
                  Next
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </nav>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
