export default function CommunityPageSkeleton({ rows = 5 }: { rows?: number }) {
  return <div aria-label="Loading" className="animate-pulse space-y-3">{Array.from({ length: rows }, (_, i) => <div key={i} className="h-16 rounded-lg bg-forum-50" />)}</div>;
}
