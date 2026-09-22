import { useEffect, useRef } from 'react';
export default function CommunityLoadMore({ more, load }: { more: boolean; load: () => Promise<void> }) {
  const ref = useRef<HTMLDivElement>(null); const latest = useRef(load); latest.current = load;
  useEffect(() => {
    if (!more || !ref.current) return;
    const observer = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) void latest.current(); });
    observer.observe(ref.current); return () => observer.disconnect();
  }, [more, load]);
  return more ? <div ref={ref} aria-label="Loading more results" className="h-1" /> : null;
}
