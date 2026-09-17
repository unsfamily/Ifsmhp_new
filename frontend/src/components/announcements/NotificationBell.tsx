import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { notificationsApi } from '../../api/notifications';
import { usePolledApiData } from '../../hooks/usePolledApiData';
export default function NotificationBell() {
  const [tick, setTick] = useState(0);
  useEffect(() => { const refresh = () => setTick(n => n + 1); window.addEventListener('notifications-read', refresh); return () => window.removeEventListener('notifications-read', refresh); }, []);
  const inbox = usePolledApiData(() => notificationsApi.list({ page: 1, limit: 1 }), [tick], 30000);
  const unread = inbox.data?.unread;
  return <Link to="/dashboard/notifications" title={inbox.error ? 'Notifications unavailable' : `Notifications${unread ? ` (${unread} unread)` : ''}`} aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`} className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-muted hover:bg-forum-50 hover:text-forum-700">
    <Bell className="h-4.5 w-4.5" />{unread ? <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-brass-500 px-1 text-center text-[10px] text-white">{unread > 99 ? '99+' : unread}</span> : null}
  </Link>;
}
