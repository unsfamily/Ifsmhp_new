import { useEffect, useState } from 'react';

/** Refresh announcement surfaces together and immediately on returning to the tab. */
export function useAnnouncementUpdates() {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState !== 'hidden') setRevision(n => n + 1); };
    window.addEventListener('notifications-read', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('notifications-read', refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return revision;
}
