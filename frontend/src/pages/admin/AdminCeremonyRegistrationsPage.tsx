import { Award } from 'lucide-react';
import { useState } from 'react';
import Button from '../../components/common/Button';
import { Card, CardContent, CardHeader } from '../../components/common/Card';
import { adminApi, type CeremonyRegistrationRow } from '../../api/admin';
import { useApiData } from '../../hooks/useApiData';

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export default function AdminCeremonyRegistrationsPage() {
  const [reload, setReload] = useState(0);
  const { data, loading, error } = useApiData(
    () => adminApi.ceremonyRegistrations({ ceremony: 'second-international', page: 1, limit: 50 }),
    [reload],
  );
  const rows = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Award className="mt-1 h-6 w-6 text-brass-600" aria-hidden="true" />
        <div>
          <h1 className="font-display text-2xl font-semibold text-forum-900">Ceremony registrations</h1>
          <p className="mt-1 max-w-3xl text-sm text-ink-muted">
            Interest in the Second International Awards Ceremony. A registration does not confirm an award, a poster, or admission.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm text-ink-muted">{loading ? 'Loading ceremony registrations…' : `${data?.pagination.total ?? 0} registration${data?.pagination.total === 1 ? '' : 's'}`}</p>
        </CardHeader>
        <CardContent>
          {error && (
            <div role="alert" className="space-y-3">
              <p className="text-sm text-danger-600">{error}</p>
              <Button type="button" variant="outline" onClick={() => setReload((value) => value + 1)}>Try again</Button>
            </div>
          )}
          {!error && !loading && rows.length === 0 && <p className="text-sm text-ink-muted">No ceremony registrations yet.</p>}
          {!error && rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-ink-subtle">
                  <tr>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Phone</th>
                    <th className="px-3 py-2 font-medium">Institution</th>
                    <th className="px-3 py-2 font-medium">Designation</th>
                    <th className="px-3 py-2 font-medium">Participation</th>
                    <th className="px-3 py-2 font-medium">Message</th>
                    <th className="px-3 py-2 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row: CeremonyRegistrationRow) => (
                    <tr key={row.id} className="border-t border-paper-border align-top">
                      <td className="px-3 py-3 font-medium text-forum-900">{row.fullName}</td>
                      <td className="px-3 py-3">{row.email}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{row.phone}</td>
                      <td className="px-3 py-3">{row.institution}</td>
                      <td className="px-3 py-3">{row.designation || '—'}</td>
                      <td className="px-3 py-3">{row.participationLabel}</td>
                      <td className="px-3 py-3 max-w-xs whitespace-pre-wrap break-words">{row.message || '—'}</td>
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
