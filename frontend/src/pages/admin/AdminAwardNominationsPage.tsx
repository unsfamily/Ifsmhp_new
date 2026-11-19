import { Award, Eye, Trash2 } from 'lucide-react';
import { useState } from 'react';
import Button from '../../components/common/Button';
import { Card, CardContent, CardHeader } from '../../components/common/Card';
import Pagination from '../../components/announcements/Pagination';
import { adminApi, type AwardNominationDetail, type AwardNominationRow } from '../../api/admin';
import { normalizeError } from '../../api/client';
import { useApiData } from '../../hooks/useApiData';

const divisionLabel: Record<string, string> = {
  DISTINGUISHED_FELLOWS: 'Senior — Distinguished Fellows (Lifetime Contribution)',
  EXCELLENCE: 'Mid-career — Excellence (Established Contribution)',
  RISING_ACHIEVERS: 'Young — Rising Achievers (Emerging Contribution)',
};

const nominationTypeLabel: Record<string, string> = {
  SELF: 'Self nomination',
  INSTITUTIONAL: 'Institutional nomination',
  COLLEAGUE: 'Colleague nomination',
};

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function DetailBlock({ title, rows }: { title: string; rows: Array<{ label: string; value: string }> }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-forum-900">{title}</h3>
      <dl className="grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label}>
            <dt className="text-xs uppercase tracking-wide text-ink-subtle">{row.label}</dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm text-forum-900">{row.value || '—'}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function AdminAwardNominationsPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [reload, setReload] = useState(0);
  const [view, setView] = useState<AwardNominationDetail | null>(null);
  const [viewError, setViewError] = useState('');
  const [viewLoading, setViewLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AwardNominationRow | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const { data, loading, error } = useApiData(
    () => adminApi.awardNominations({ ceremony: 'second-international', page, limit }),
    [reload, page, limit],
  );
  const rows = data?.items ?? [];

  const openView = async (row: AwardNominationRow) => {
    setView(null);
    setViewError('');
    setViewLoading(true);
    try {
      setView(await adminApi.awardNomination(row.id));
    } catch (caught) {
      setViewError(normalizeError(caught).message);
    } finally {
      setViewLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await adminApi.deleteAwardNomination(pendingDelete.id);
      setPendingDelete(null);
      if (rows.length === 1 && page > 1) setPage(page - 1);
      else setReload((value) => value + 1);
    } catch (caught) {
      setDeleteError(normalizeError(caught).message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Award className="mt-1 h-6 w-6 text-brass-600" aria-hidden="true" />
        <div>
          <h1 className="font-display text-2xl font-semibold text-forum-900">Award nominations</h1>
          <p className="mt-1 max-w-3xl text-sm text-ink-muted">
            Nominations for the 2nd International IFSMHP Awards 2026. A nomination does not mean the nominee has been selected.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <p className="text-sm text-ink-muted">{loading && !data ? 'Loading award nominations…' : `${data?.pagination.total ?? 0} nomination${data?.pagination.total === 1 ? '' : 's'}`}</p>
        </CardHeader>
        <CardContent>
          {error && (
            <div role="alert" className="space-y-3">
              <p className="text-sm text-danger-600">{error}</p>
              <Button type="button" variant="outline" onClick={() => setReload((value) => value + 1)}>Try again</Button>
            </div>
          )}
          {!error && !loading && rows.length === 0 && <p className="text-sm text-ink-muted">No award nominations yet.</p>}
          {!error && rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-ink-subtle">
                  <tr>
                    <th className="px-3 py-2 font-medium">Reference</th>
                    <th className="px-3 py-2 font-medium">Nominee</th>
                    <th className="px-3 py-2 font-medium">Award</th>
                    <th className="px-3 py-2 font-medium">Nominator</th>
                    <th className="px-3 py-2 font-medium">Acknowledgement</th>
                    <th className="px-3 py-2 font-medium">Updated</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row: AwardNominationRow) => (
                    <tr key={row.id} className="border-t border-paper-border align-top">
                      <td className="px-3 py-3 font-medium text-forum-900">{row.reference}</td>
                      <td className="px-3 py-3">{row.nomineeName}<br /><span className="text-ink-muted">{row.nomineeEmail}</span></td>
                      <td className="px-3 py-3">{row.awardName}{row.division ? <><br /><span className="text-ink-muted">{divisionLabel[row.division] ?? row.division}</span></> : null}</td>
                      <td className="px-3 py-3">{row.nominatorName}<br /><span className="text-ink-muted">{row.nominatorEmail}</span></td>
                      <td className="px-3 py-3">{row.acknowledgementSentAt ? formatWhen(row.acknowledgementSentAt) : 'Not sent'}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{formatWhen(row.updatedAt)}</td>
                      <td className="px-3 py-3">
                        <div className="flex gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => { void openView(row); }}>
                            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                            View
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => { setDeleteError(''); setPendingDelete(row); }}>
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data && !error && data.pagination.total > 0 && (
            <Pagination meta={data.pagination} page={page} limit={limit} setPage={setPage} setLimit={(value) => { setLimit(value); setPage(1); }} />
          )}
        </CardContent>
      </Card>

      {(viewLoading || view || viewError) && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="nomination-view-title">
          <div className="w-full max-w-3xl rounded-2xl bg-paper p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <h2 id="nomination-view-title" className="font-display text-xl font-semibold text-forum-900">{view?.reference ?? 'Award nomination'}</h2>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setView(null); setViewError(''); setViewLoading(false); }}>Close</Button>
            </div>
            {viewLoading && <p className="mt-4 text-sm text-ink-muted">Loading nomination…</p>}
            {viewError && <p role="alert" className="mt-4 text-sm text-danger-600">{viewError}</p>}
            {view && (
              <div className="mt-5 space-y-6">
                <DetailBlock title="Nominee" rows={[
                  { label: 'Name', value: view.nomineeName },
                  { label: 'Email', value: view.nomineeEmail },
                  { label: 'Phone', value: view.nomineePhone },
                  { label: 'Date of birth', value: view.dateOfBirth },
                  { label: 'Nationality', value: view.nationality },
                  { label: 'Country of residence', value: view.countryOfResidence },
                  { label: 'Qualification', value: view.qualification },
                  { label: 'Designation', value: view.designation },
                  { label: 'Institution', value: view.institution },
                  { label: 'Specialisation', value: view.specialisation },
                  { label: 'Years of contribution', value: view.yearsOfContribution },
                  { label: 'ORCID', value: view.orcid ?? '' },
                ]} />
                <DetailBlock title="Award" rows={[
                  { label: 'Award', value: view.awardName },
                  { label: 'Division', value: view.division ? (divisionLabel[view.division] ?? view.division) : '' },
                  { label: 'Nomination type', value: nominationTypeLabel[view.nominationType] ?? view.nominationType },
                  { label: 'Declared', value: formatWhen(view.declaredAt) },
                ]} />
                <DetailBlock title="Nomination" rows={[
                  { label: 'Career overview', value: view.careerOverview },
                  { label: 'Principal contributions', value: view.principalContributions },
                  { label: 'Impact', value: view.impact },
                  { label: 'Leadership', value: view.leadership },
                  { label: 'Major awards', value: view.majorAwards },
                  { label: 'Publications', value: view.publications },
                  { label: 'Patents', value: view.patents },
                  { label: 'Projects', value: view.projects },
                  { label: 'Institutions established', value: view.institutionsEstablished },
                  { label: 'Societal impact', value: view.societalImpact },
                  { label: 'Statement', value: view.statement },
                ]} />
                <DetailBlock title="Nominator" rows={[
                  { label: 'Name', value: view.nominatorName },
                  { label: 'Email', value: view.nominatorEmail },
                  { label: 'Phone', value: view.nominatorPhone },
                  { label: 'Designation', value: view.nominatorDesignation },
                  { label: 'Institution', value: view.nominatorInstitution },
                  { label: 'Relationship', value: view.relationship },
                ]} />
              </div>
            )}
          </div>
        </div>
      )}

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="nomination-delete-title">
          <div className="w-full max-w-md rounded-2xl bg-paper p-6 shadow-xl">
            <h2 id="nomination-delete-title" className="font-display text-xl font-semibold text-forum-900">Are you OK to delete the nominee?</h2>
            <p className="mt-2 text-sm text-ink-muted">{pendingDelete.nomineeName} · {pendingDelete.reference}</p>
            {deleteError && <p role="alert" className="mt-3 text-sm text-danger-600">{deleteError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPendingDelete(null)} disabled={deleting}>Cancel</Button>
              <Button type="button" onClick={() => { void confirmDelete(); }} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
