import Badge from '../common/Badge';
import type { MembershipStatus } from '../../types/community';

export default function MembershipStatusBadge({ status }: { status: MembershipStatus }) {
  const variant = status === 'ACTIVE' ? 'success' : status === 'PENDING' ? 'warning' : status === 'BLOCKED' ? 'danger' : 'default';
  return <Badge variant={variant}>{status}</Badge>;
}
