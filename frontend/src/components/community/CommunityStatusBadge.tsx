import Badge from '../common/Badge';
import type { CommunityStatus, ReportStatus } from '../../types/community';

export default function CommunityStatusBadge({ status }: { status: CommunityStatus | ReportStatus }) {
  const variant = status === 'ACTIVE' || status === 'RESOLVED' ? 'success'
    : status === 'OPEN' ? 'danger' : status === 'UNDER_REVIEW' ? 'warning' : 'default';
  return <Badge variant={variant}>{status.replaceAll('_', ' ')}</Badge>;
}
