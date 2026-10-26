import { Award } from 'lucide-react';
import { useState } from 'react';
import Button from '../../components/common/Button';
import { Card, CardContent, CardHeader } from '../../components/common/Card';
import { adminApi, type AwardNominationRow } from '../../api/admin';
import { useApiData } from '../../hooks/useApiData';

const divisionLabel: Record<string, string> = {
  DISTINGUISHED_FELLOWS: 'Senior — Distinguished Lifetime Contribution',
  EXCELLENCE: 'Mid-career — Distinguished Excellence',
  RISING_ACHIEVERS: 'Young — Emerging Excellence',
};

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export default function AdminAwardNominationsPage() {
  const [reload, setReload] = useState(0);
  const { data, loading, error } = useApiData(
    () => adminApi.awardNominations({ ceremony: 'second-international', page: 1, limit: 50 }),
    [reload],
  );
  const rows = data?.items ?? [];

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
          <p className="text-sm text-ink-muted">{loading ? 'Loading award nominations…' : `${data?.pagination.total ?? 0} nomination${data?.pagination.total === 1 ? '' : 's'}`}</p>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
