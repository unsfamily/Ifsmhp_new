import { apiClient } from './client';

interface Envelope<T> { success: true; data: T }

export type ReportCategory = 'Membership' | 'Publications' | 'Support' | 'Engagement' | 'Platform' | 'Finance';
export type ReportCadence = 'Monthly' | 'Weekly' | 'Quarterly' | 'On-demand' | 'Real-time';
export type Trend = 'up' | 'down' | 'flat';

export interface ReportKpi {
  label: string;
  value: string;
  sub: string;
  trend: Trend;
  trendValue: string;
}

export interface ReportTile {
  id: string;
  key: string;
  title: string;
  category: ReportCategory;
  description: string;
  cadence: ReportCadence;
  format: 'PDF' | 'XLSX' | 'Both';
  recipient?: string;
  metric: string;
  samplePeriod: string;
  lastRun?: string;
  nextRun?: string;
  trend: Trend;
  trendValue: string;
}

export interface ReportAttention {
  when: string;
  title: string;
  issue: string;
  severity: 'warning' | 'danger' | 'default';
}

export interface ReportCatalog {
  range: { from: string; to: string; label: string };
  kpis: ReportKpi[];
  reports: ReportTile[];
  attention: ReportAttention[];
}

export interface ReportColumn { key: string; label: string }
export type ReportRow = Record<string, string | number | null>;

export interface ReportRowsResult {
  key: string;
  title: string;
  format: string;
  samplePeriod: string;
  columns: ReportColumn[];
  items: ReportRow[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export interface ReportRunResult {
  key: string;
  runId: string;
  status: string;
  rows: number;
  lastRun: string;
  nextRun: string | null;
}

/** Bounds are omitted when blank so the server applies its trailing-30-day default. */
export interface ReportRange { from?: string; to?: string }

const root = '/admin/reports';
const clean = (range: ReportRange) => ({ ...(range.from ? { from: range.from } : {}), ...(range.to ? { to: range.to } : {}) });

export const reportsApi = {
  catalog: async (range: ReportRange = {}) =>
    (await apiClient.get<Envelope<ReportCatalog>>(root, { params: clean(range) })).data.data,

  rows: async (key: string, range: ReportRange, page: number, limit: number) =>
    (await apiClient.get<Envelope<ReportRowsResult>>(`${root}/${encodeURIComponent(key)}`, { params: { ...clean(range), page, limit } })).data.data,

  run: async (key: string, range: ReportRange = {}) =>
    (await apiClient.post<Envelope<ReportRunResult>>(`${root}/${encodeURIComponent(key)}/run`, {}, { params: clean(range) })).data.data,

  /**
   * Downloads a report as CSV.
   *
   * Fetched through `apiClient` as a blob rather than used as a plain `href`,
   * because the route is bearer-authenticated — an anchor would send no token
   * and 401. Mirrors `downloadAttachment` in api/messaging.ts.
   */
  download: async (key: string, range: ReportRange = {}) => {
    const response = await apiClient.get(`${root}/${encodeURIComponent(key)}/export`, { params: clean(range), responseType: 'blob' });
    const disposition = String(response.headers['content-disposition'] ?? '');
    const match = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
    const filename = match?.[1] ? decodeURIComponent(match[1]) : `${key}.csv`;

    const url = URL.createObjectURL(response.data as Blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    return filename;
  },
};
