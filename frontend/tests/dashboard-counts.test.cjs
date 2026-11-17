const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

describe('dashboard list counts', () => {
  it('uses the same totals the destination lists display', async () => {
    const moduleUrl = pathToFileURL(path.join(__dirname, '../src/pages/admin/dashboardCounts.ts')).href;
    const { dashboardCountsFromLists } = await import(moduleUrl);
    const counts = dashboardCountsFromLists({
      members: {
        accountCounts: { total: 16, active: 10, pending: 3, suspended: 1, deactivated: 1, rejected: 1 },
        counts: { pending: 2, underReview: 1, urgent: 0, approvedToday: 0, inQueue: 3 },
      },
      projects: { counts: { total: 8, inReview: 2, approved: 1, published: 4, slaBreach: 0, slaTargetDays: 14, urgent: 0 } },
      publications: { pagination: { page: 1, limit: 1, total: 5, pages: 5 } },
      openSupportRequests: 4,
      upcomingEvents: 1,
    });
    assert.deepEqual(counts, {
      totalMembers: 16,
      pendingApplications: 3,
      researchProjects: 8,
      publicationsAwaitingReview: 5,
      openSupportRequests: 4,
      upcomingEvents: 1,
    });
  });
});
