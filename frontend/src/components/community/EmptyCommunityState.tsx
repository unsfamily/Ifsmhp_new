import { Inbox } from 'lucide-react';
import Button from '../common/Button';

export default function EmptyCommunityState({ title, description, error, retry }: { title: string; description?: string; error?: string | null; retry?: () => void }) {
  return <div className="rounded-lg border border-dashed border-paper-border px-6 py-12 text-center">
    <Inbox className="mx-auto h-9 w-9 text-forum-300" />
    <h3 className="mt-3 font-semibold text-forum-900">{error ? 'Unable to load data' : title}</h3>
    <p role={error ? 'alert' : undefined} className="mx-auto mt-1 max-w-lg text-sm text-ink-muted">{error ?? description}</p>
    {error && retry && <Button className="mt-4" size="sm" variant="outline" onClick={retry}>Retry</Button>}
  </div>;
}
