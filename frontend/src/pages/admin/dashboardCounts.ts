/**
 * The six dashboard figures, taken from the same fields the destination
 * screens show. The cards must not invent a second definition of "total".
 */
export interface DashboardCounts {
  totalMembers: number;
  pendingApplications: number;
  researchProjects: number;
  publicationsAwaitingReview: number;
  openSupportRequests: number;
  upcomingEvents: number;
}

export function dashboardCountsFromLists(input: {
  members: { accountCounts: { total: number }; counts: { inQueue: number } };
  projects: { counts: { total: number } };
  publications: { pagination: { total: number } };
  openSupportRequests: number;
  upcomingEvents: number;
}): DashboardCounts {
  return {
    // All Members "Total" card and the sidebar badge.
    totalMembers: input.members.accountCounts.total,
    // Pending Applications "In Queue" card and the sidebar badge.
    pendingApplications: input.members.counts.inQueue,
    // Research Projects "Total Projects" card.
    researchProjects: input.projects.counts.total,
    // Publications review tab, the list opened from this card.
    publicationsAwaitingReview: input.publications.pagination.total,
    // Support Requests "Open Tickets" card.
    openSupportRequests: input.openSupportRequests,
    // Events upcoming tab.
    upcomingEvents: input.upcomingEvents,
  };
}
