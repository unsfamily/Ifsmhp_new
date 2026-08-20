import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
      <h1 className="text-2xl font-semibold text-forum-900">Page not found</h1>
      <p className="mt-3 max-w-prose text-ink-muted">
        This address does not match any page on the forum. It may have moved, or the link may be
        incomplete.
      </p>
      <Link
        to="/"
        className="mt-6 inline-block rounded border border-forum-600 px-4 py-2 text-sm font-medium text-forum-600 hover:bg-forum-50"
      >
        Return to the homepage
      </Link>
    </div>
  );
}
