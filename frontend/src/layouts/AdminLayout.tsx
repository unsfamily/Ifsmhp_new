import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  FileText,
  MessageSquare,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Bell,
  BookOpenCheck,
  Calendar,
  Mail,
  History,
  Settings,
  UserCircle,
  Clock,
  Images,
} from 'lucide-react';
import Badge from '../components/common/Badge';
import logoImg from '../assets/images/logo.png';
import { useAuth } from '../context/AuthContext';
import { adminApi } from '../api/admin';
import { useApiData } from '../hooks/useApiData';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  badgeKey?: keyof AdminCounts;
}

interface NavSection {
  heading: string;
  items: NavItem[];
}

/** Sidebar counts that have a real source in GET /admin/stats. */
interface AdminCounts {
  /** Every row the members directory lists. */
  directoryTotal: number;
  totalMembers: number;
  membershipPending: number;
  publicationsQueue: number;
  openSupportTickets: number;
  messagesAwaitingReply: number;
  newInquiries: number;
}

const navSections: NavSection[] = [
  {
    heading: 'Overview',
    items: [
      { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    ],
  },
  {
    heading: 'Members',
    items: [
      { to: '/admin/members', label: 'All Members', icon: Users, badgeKey: 'directoryTotal' },
      { to: '/admin/members/pending', label: 'Pending Applications', icon: Clock, badgeKey: 'membershipPending' },
    ],
  },
  {
    heading: 'Research & Content',
    items: [
      { to: '/admin/projects', label: 'Research Projects', icon: FolderKanban },
      { to: '/admin/publications', label: 'Publications', icon: FileText, badgeKey: 'publicationsQueue' },
      { to: '/admin/gallery', label: 'Media Gallery', icon: Images },
    ],
  },
  {
    heading: 'Operations',
    items: [
      { to: '/admin/support', label: 'Support Requests', icon: ShieldCheck, badgeKey: 'openSupportTickets' },
      { to: '/admin/messages', label: 'Messages', icon: MessageSquare, badgeKey: 'messagesAwaitingReply' },
      { to: '/admin/events', label: 'Events', icon: Calendar },
      { to: '/admin/inquiries', label: 'Contact Inquiries', icon: Mail, badgeKey: 'newInquiries' },
    ],
  },
  {
    heading: 'Administration',
    items: [
      { to: '/admin/notifications', label: 'Notifications', icon: Bell },
      { to: '/admin/audit-log', label: 'Audit Log', icon: History },
    ],
  },
];

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Real counts; a failure just leaves the badges off rather than showing
  // numbers that contradict the pages they label.
  const { data: stats } = useApiData<AdminCounts>(() => adminApi.stats() as Promise<AdminCounts>, []);
  const { user, logout } = useAuth();
  const loc = useLocation();

  const allNavItems = navSections.flatMap((s) => s.items);
  const currentPage = allNavItems.find((n) =>
    n.end ? loc.pathname === n.to : loc.pathname.startsWith(n.to)
  );

  return (
    <div className="min-h-screen bg-paper lg:flex">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <div
        className={`fixed inset-0 z-40 bg-forum-900/50 backdrop-blur-sm lg:hidden transition-opacity ${
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setSidebarOpen(false)}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 transform bg-forum-900 text-forum-100 transition-transform lg:translate-x-0 lg:sticky lg:top-0 lg:z-auto flex flex-col h-screen overflow-hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between px-5 border-b border-forum-700 shrink-0">
          <Link to="/admin" className="flex items-center gap-2.5">
            <img
              src={logoImg}
              alt="IFSMHP Logo"
              className="h-9 w-9 rounded-md object-contain bg-white p-0.5"
            />
            <div className="leading-tight">
              <span className="block font-display text-base font-semibold text-white">
                IFSMHP Admin
              </span>
              <span className="block text-[10px] uppercase tracking-wider text-forum-200/60">
                Chief Research Office
              </span>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-forum-200/70 hover:text-white"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 border-b border-forum-700 shrink-0">
          <div className="rounded-xl bg-forum-800/50 ring-1 ring-forum-700 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brass-500 text-white font-semibold">
                CRO
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-white text-sm truncate">
                  {user?.fullName ?? 'Office of the CRO'}
                </p>
                <Badge variant="brass">
                  <ShieldCheck className="h-2.5 w-2.5 mr-1" />
                  Administrator
                </Badge>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-[11px] text-forum-200/70">
                <span className="h-2 w-2 rounded-full bg-success-100 border border-success-600/30" />
                42 members online
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-5">
          {navSections.map((section) => (
            <div key={section.heading}>
              <p className="px-3 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-wider text-forum-200/40">
                {section.heading}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-forum-700 text-white shadow-sm'
                            : 'text-forum-100/80 hover:bg-forum-800 hover:text-white'
                        }`
                      }
                    >
                      <Icon className="h-4.5 w-4.5 shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badgeKey && stats?.[item.badgeKey] ? (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brass-500 px-1.5 text-[11px] font-semibold text-white">
                          {stats[item.badgeKey]}
                        </span>
                      ) : null}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-forum-700 shrink-0 bg-forum-900">
          <div className="p-3 space-y-1">
            <Link
              to="/admin/profile"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-forum-100/80 hover:bg-forum-800 hover:text-white transition-colors"
            >
              <UserCircle className="h-4.5 w-4.5 shrink-0" />
              <span className="flex-1">Admin Profile</span>
            </Link>
            <Link
              to="/admin/settings"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-forum-100/80 hover:bg-forum-800 hover:text-white transition-colors"
            >
              <Settings className="h-4.5 w-4.5 shrink-0" />
              <span className="flex-1">Settings</span>
            </Link>
            <button
              type="button"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-forum-100/70 hover:bg-forum-800 hover:text-white transition-colors"
              onClick={() => void logout()}
            >
              <LogOut className="h-4.5 w-4.5 shrink-0" />
              <span className="flex-1 text-left">Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-16 border-b border-paper-border bg-paper-raised/95 backdrop-blur-sm shrink-0">
          <div className="flex items-center justify-between h-full px-4 sm:px-6">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden inline-flex items-center justify-center rounded-md p-2 text-ink-muted hover:bg-forum-50 hover:text-forum-700 shrink-0"
                aria-label="Open sidebar"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="hidden sm:block min-w-0">
                <h1 className="text-lg font-display font-semibold text-forum-900 truncate">
                  {currentPage?.label || 'Admin Dashboard'}
                </h1>
                <p className="text-xs text-ink-subtle truncate">
                  Chief Research Office · <span className="font-medium text-ink-muted">Elevated permissions</span>
                </p>
              </div>
              <div className="sm:hidden">
                <h1 className="text-base font-display font-semibold text-forum-900">
                  {currentPage?.label || 'Admin'}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <Link
                to="/admin/notifications"
                className="relative inline-flex items-center justify-center rounded-md h-9 w-9 text-ink-muted hover:bg-forum-50 hover:text-forum-700 transition-colors"
                aria-label="Notifications"
              >
                <Bell className="h-4.5 w-4.5" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-brass-500 ring-2 ring-paper-raised" />
              </Link>
              <Link
                to="/dashboard"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-forum-50 hover:text-forum-700 transition-colors"
              >
                <BookOpenCheck className="h-3.5 w-3.5" />
                Member View
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </header>

        <main id="main" className="flex-1 px-4 py-6 sm:px-6 sm:py-8 overflow-x-hidden">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
