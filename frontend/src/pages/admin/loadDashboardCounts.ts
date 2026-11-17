import { adminApi } from '../../api/admin';
import { eventApi } from '../../api/events';
import { supportApi } from '../../api/support';
import { dashboardCountsFromLists, type DashboardCounts } from './dashboardCounts';

/** Loads one page of each list and reads the standing totals those pages display. */
export async function loadDashboardCounts(): Promise<DashboardCounts> {
  const [members, projects, publications, support, events] = await Promise.all([
    adminApi.members({ page: 1, limit: 1 }),
    adminApi.projects({ page: 1, limit: 1 }),
    adminApi.publications({ queue: 'review', page: 1, limit: 1 }),
    supportApi.list(true, { page: 1, limit: 1 }),
    eventApi.list({ tab: 'upcoming', q: '', page: 1, limit: 1 }),
  ]);
  return dashboardCountsFromLists({
    members,
    projects,
    publications,
    openSupportRequests: support.stats.open,
    upcomingEvents: events.pagination.total,
  });
}
